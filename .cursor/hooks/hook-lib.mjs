import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro"]);

export function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function editedPath(payload) {
  const input = payload?.tool_input;
  if (!input || typeof input !== "object") return "";
  const candidate = input.file_path ?? input.path ?? input.target_file ?? "";
  return typeof candidate === "string" ? candidate : "";
}

function gitOut(start, args) {
  if (!start || !fs.existsSync(start)) return "";
  const result = spawnSync("git", args, { cwd: start, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return "";
  return (result.stdout || "").trim();
}

export function gitTop(start) {
  return gitOut(start, ["rev-parse", "--show-toplevel"]);
}

export function gitCommon(start) {
  const dir = gitOut(start, ["rev-parse", "--git-common-dir"]);
  if (!dir) return "";
  return path.resolve(start, dir);
}

export function resolveEditedFile(payload) {
  const raw = editedPath(payload);
  if (!raw) return null;
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const absolute = path.resolve(cwd, raw);
  if (!fs.existsSync(absolute)) return { absolute, root: "", skipped: "missing" };
  const root = gitTop(path.dirname(absolute));
  if (!root) return { absolute, root: "", skipped: "outside-git" };
  const session = gitCommon(cwd) || gitCommon(process.cwd());
  const fileCommon = gitCommon(root);
  if (session && fileCommon && path.resolve(session) !== path.resolve(fileCommon)) {
    return { absolute, root: "", skipped: "other-repo" };
  }
  return { absolute, root, relative: path.relative(root, absolute), skipped: "" };
}

export function isLinted(filePath) {
  return LINT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

const localEntries = {
  eslint: ["eslint", "bin", "eslint.js"],
  astro: ["astro", "bin", "astro.mjs"],
};

function bin(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function withNodeOnPath(env) {
  const nodeDir = path.dirname(process.execPath);
  const combined = [nodeDir, env.PATH, env.Path].filter(Boolean).join(path.delimiter);
  env.PATH = combined;
  env.Path = combined;
  return env;
}

export function runBin(name, args, cwd) {
  const env = withNodeOnPath({ ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" });
  const parts = localEntries[name];
  const local = parts ? path.join(cwd, "node_modules", ...parts) : "";
  if (local && fs.existsSync(local)) {
    return spawnSync(process.execPath, [local, ...args], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      env,
    });
  }
  return spawnSync(bin(name), args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env,
    shell: process.platform === "win32",
  });
}

export function toolMissing(result) {
  if (result.error || result.status === null) return result.error?.message || "tool is not available";
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (/not recognized|command not found|ENOENT/i.test(output)) return output.trim();
  return "";
}

export function emit(field, message) {
  process.stdout.write(`${JSON.stringify({ [field]: message })}\n`);
}

export function registryPath(id) {
  const safe = String(id || "default").replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(os.tmpdir(), `cursor-hook-checkouts-${safe}`);
}

export function rememberCheckout(id, root) {
  if (!id || !root) return;
  const file = registryPath(id);
  const prior = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = new Set(prior.split(/\r?\n/).filter(Boolean));
  lines.add(root);
  fs.writeFileSync(file, `${[...lines].join("\n")}\n`);
}

export function readCheckouts(id) {
  const file = registryPath(id);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
}

export function clearCheckouts(id) {
  const file = registryPath(id);
  if (fs.existsSync(file)) fs.rmSync(file);
}

export function changedFiles(root) {
  const diff = spawnSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  const untracked = spawnSync("git", ["ls-files", "-o", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (diff.status !== 0 && untracked.status !== 0) return [];
  const names = `${diff.stdout || ""}\n${untracked.stdout || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [...new Set(names)].filter((name) => fs.existsSync(path.join(root, name)));
}
