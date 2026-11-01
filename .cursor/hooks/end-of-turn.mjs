#!/usr/bin/env node
// stop: lint changed files, then typecheck diagnostics that name those files. One follow-up.
import {
  changedFiles,
  clearCheckouts,
  emit,
  gitTop,
  isLinted,
  parsePayload,
  readCheckouts,
  readStdin,
  runBin,
  toolMissing,
} from "./hook-lib.mjs";

const payload = parsePayload(readStdin());
const status = payload.status ?? "completed";
const loops = Number(payload.loop_count ?? 0);
if (status !== "completed" || loops !== 0) process.exit(0);

const sessionId = payload.conversation_id || payload.session_id || "";
const seeds = [];
if (typeof payload.cwd === "string") seeds.push(payload.cwd);
if (Array.isArray(payload.workspace_roots)) seeds.push(...payload.workspace_roots.filter((item) => typeof item === "string"));
seeds.push(process.cwd(), ...readCheckouts(sessionId));

const roots = [];
for (const seed of seeds) {
  const root = gitTop(seed);
  if (root && !roots.includes(root)) roots.push(root);
}

const parts = [];
let sawChange = false;
for (const root of roots) {
  const changed = changedFiles(root);
  if (changed.length === 0) continue;
  sawChange = true;
  const linted = changed.filter((name) => isLinted(name));
  if (linted.length > 0) {
    const lint = runBin("eslint", ["--quiet", ...linted], root);
    const lintMissing = toolMissing(lint);
    if (lintMissing) {
      parts.push(`ESLint did not run: ${lintMissing}`);
    } else if (lint.status !== 0) {
      parts.push(`ESLint errors in changed files:\n${`${lint.stdout || ""}${lint.stderr || ""}`.trim()}`);
    }
  }

  const check = runBin("astro", ["check"], root);
  const checkMissing = toolMissing(check);
  if (checkMissing) {
    parts.push(`Typecheck did not run: ${checkMissing}`);
  } else if (check.status !== 0) {
    const output = `${check.stdout || ""}${check.stderr || ""}`;
    const relevant = output
      .split(/\r?\n/)
      .filter((line) => changed.some((name) => line.includes(name.replaceAll("\\", "/"))))
      .join("\n")
      .trim();
    if (relevant) parts.push(`Typecheck fails:\n${relevant}`);
  }
}

if (!sawChange) {
  clearCheckouts(sessionId);
  process.exit(0);
}
if (parts.length > 0) {
  emit("followup_message", `Fix these before you finish:\n${parts.join("\n")}`);
} else {
  clearCheckouts(sessionId);
}
process.exit(0);
