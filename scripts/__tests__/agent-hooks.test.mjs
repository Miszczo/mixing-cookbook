import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const hooksDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.cursor/hooks");
const lintScript = path.join(hooksDir, "lint-edited-file.mjs");
const stopScript = path.join(hooksDir, "end-of-turn.mjs");

function writeStubBin(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const stub = `import fs from "node:fs";
const files = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const tool = process.env.STUB_TOOL;
let failed = false;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (tool === "eslint" && text.includes("HOOK_LINT_ERROR")) {
    console.log(file + ":1:1 error unused HOOK_LINT_ERROR");
    failed = true;
  }
}
if (tool === "astro") {
  const root = process.cwd();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === ".git" || name === "node_modules") continue;
      const full = dir + "/" + name;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (fs.readFileSync(full, "utf8").includes("HOOK_TYPE_ERROR")) {
        const rel = full.slice(root.length + 1).replaceAll("\\\\", "/");
        console.log(rel + ":1:1 - error ts(1): HOOK_TYPE_ERROR");
        failed = true;
      }
    }
  };
  walk(root);
}
if (tool === "eslint" && files.length === 0 && process.env.STUB_MISSING === "1") process.exit(127);
process.exit(failed ? 1 : 0);
`;
  fs.writeFileSync(path.join(dir, "stub.mjs"), stub);
  const wrap = (name, tool) => {
    const cmd = `@echo off\r\nset STUB_TOOL=${tool}\r\nnode "%~dp0stub.mjs" %*\r\n`;
    fs.writeFileSync(path.join(dir, `${name}.cmd`), cmd);
  };
  wrap("eslint", "eslint");
  wrap("astro", "astro");
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function initRepo(name) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  git(cwd, ["init"]);
  git(cwd, ["add", "-A"]);
  return cwd;
}

function commitAll(cwd) {
  git(cwd, ["add", "-A"]);
  git(cwd, ["-c", "user.email=hook@example.com", "-c", "user.name=hook", "commit", "-m", "init", "--allow-empty"]);
}

const stubBin = fs.mkdtempSync(path.join(os.tmpdir(), "hook-stub-"));
writeStubBin(stubBin);

function runHook(script, payload, cwd, extraEnv = {}) {
  const bin = extraEnv.PATH ? "" : stubBin;
  return spawnSync(process.execPath, [script], {
    cwd,
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      CURSOR_PROJECT_DIR: extraEnv.CURSOR_PROJECT_DIR ?? cwd,
      ...extraEnv,
      PATH: extraEnv.PATH ?? `${bin}${path.delimiter}${process.env.PATH || ""}`,
    },
  });
}

test("broken file returns additional_context", () => {
  const cwd = initRepo("hook-bad");
  fs.writeFileSync(path.join(cwd, "bad.ts"), "export const value = 1;\nHOOK_LINT_ERROR\n");
  commitAll(cwd);
  const result = runHook(
    lintScript,
    { cwd, conversation_id: "bad", tool_input: { file_path: path.join(cwd, "bad.ts") } },
    cwd,
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /additional_context/);
  assert.match(result.stdout, /bad\.ts/);
});

test("clean file is silent", () => {
  const cwd = initRepo("hook-clean");
  fs.writeFileSync(path.join(cwd, "ok.ts"), "export const value = 1;\n");
  commitAll(cwd);
  const result = runHook(lintScript, { cwd, tool_input: { file_path: path.join(cwd, "ok.ts") } }, cwd);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("skipped type, missing file, and empty payloads succeed", () => {
  const cwd = initRepo("hook-skip");
  fs.writeFileSync(path.join(cwd, "README.md"), "HOOK_LINT_ERROR\n");
  commitAll(cwd);
  for (const payload of [
    { cwd, tool_input: { file_path: path.join(cwd, "README.md") } },
    { cwd, tool_input: { file_path: path.join(cwd, "missing.ts") } },
    {},
    "not json",
    { tool_name: "Write" },
  ]) {
    const result = runHook(lintScript, payload, cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
});

test("retry flag lets a dirty tree finish", () => {
  const cwd = initRepo("hook-retry");
  fs.writeFileSync(path.join(cwd, "bad.ts"), "export const x = 1;\nHOOK_LINT_ERROR\n");
  const result = runHook(stopScript, { status: "completed", loop_count: 1, cwd }, cwd);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("end of turn catches a lint error written outside the edit hook", () => {
  const cwd = initRepo("hook-sweep");
  commitAll(cwd);
  fs.writeFileSync(path.join(cwd, "sneak.ts"), "export const x = 1;\nHOOK_LINT_ERROR\n");
  const dirty = runHook(stopScript, { status: "completed", loop_count: 0, cwd, conversation_id: "sweep" }, cwd);
  assert.equal(dirty.status, 0);
  assert.match(dirty.stdout, /followup_message/);
  assert.match(dirty.stdout, /sneak\.ts/);
  const empty = initRepo("hook-empty");
  commitAll(empty);
  const clean = runHook(
    stopScript,
    { status: "completed", loop_count: 0, cwd: empty, conversation_id: "empty" },
    empty,
  );
  assert.equal(clean.stdout, "");
});

test("checkout resolution ignores another project dir and another repo", () => {
  const session = initRepo("hook-session");
  fs.writeFileSync(path.join(session, "ok.ts"), "export const value = 1;\n");
  commitAll(session);
  const other = initRepo("hook-other");
  fs.writeFileSync(path.join(other, "bad.ts"), "HOOK_LINT_ERROR\n");
  commitAll(other);
  const ignoredProjectDir = runHook(
    lintScript,
    { cwd: session, conversation_id: "sess", tool_input: { file_path: "ok.ts" } },
    session,
    { CURSOR_PROJECT_DIR: other },
  );
  assert.equal(ignoredProjectDir.stdout, "");
  const otherRepo = runHook(
    lintScript,
    { cwd: session, tool_input: { file_path: path.join(other, "bad.ts") } },
    session,
  );
  assert.equal(otherRepo.stdout, "");
  const relative = runHook(lintScript, { cwd: session, tool_input: { path: "ok.ts" } }, session);
  assert.equal(relative.status, 0);
  assert.equal(relative.stdout, "");
});

test("end of turn sweeps a sibling worktree and a missing project dir still runs the script", () => {
  const session = initRepo("hook-main");
  fs.writeFileSync(path.join(session, "ok.ts"), "export const value = 1;\n");
  commitAll(session);
  const worktree = path.join(path.dirname(session), `${path.basename(session)}-wt`);
  git(session, ["worktree", "add", "-b", "wt", worktree]);
  fs.writeFileSync(path.join(worktree, "wt.ts"), "export const value = 1;\nHOOK_LINT_ERROR\n");
  const edited = runHook(
    lintScript,
    { cwd: session, conversation_id: "wt", tool_input: { file_path: path.join(worktree, "wt.ts") } },
    session,
    { CURSOR_PROJECT_DIR: path.join(session, "does-not-exist") },
  );
  assert.match(edited.stdout, /wt\.ts/);
  const swept = runHook(
    stopScript,
    { status: "completed", loop_count: 0, cwd: session, conversation_id: "wt" },
    session,
    {
      CURSOR_PROJECT_DIR: path.join(session, "does-not-exist"),
    },
  );
  assert.match(swept.stdout, /followup_message/);
  assert.match(swept.stdout, /wt\.ts/);
});

test("missing eslint is reported", () => {
  const cwd = initRepo("hook-nolint");
  fs.writeFileSync(path.join(cwd, "bad.ts"), "export const value = 1;\n");
  commitAll(cwd);
  const whereGit = spawnSync("where.exe", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/).find(Boolean);
  const result = spawnSync(process.execPath, [lintScript], {
    cwd,
    input: JSON.stringify({ cwd, tool_input: { file_path: path.join(cwd, "bad.ts") } }),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.dirname(whereGit)}${path.delimiter}${path.dirname(process.execPath)}`,
    },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /additional_context/);
  assert.match(result.stdout, /ESLint did not run/);
});
