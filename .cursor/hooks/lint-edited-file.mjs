#!/usr/bin/env node
// postToolUse (Write): lint only the edited file. Feedback is additional_context.
import path from "node:path";
import { emit, isLinted, parsePayload, readStdin, rememberCheckout, resolveEditedFile, runBin, toolMissing } from "./hook-lib.mjs";

const payload = parsePayload(readStdin());
const edited = resolveEditedFile(payload);
if (!edited || edited.skipped || !isLinted(edited.absolute)) process.exit(0);

const sessionId = payload.conversation_id || payload.session_id || "";
rememberCheckout(sessionId, edited.root);

const result = runBin("eslint", ["--quiet", edited.absolute], edited.root);
const missing = toolMissing(result);
if (missing) {
  emit(
    "additional_context",
    `ESLint did not run for ${edited.relative || path.basename(edited.absolute)}: ${missing}`,
  );
  process.exit(0);
}
if (result.status !== 0) {
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  emit(
    "additional_context",
    `ESLint reported errors in ${edited.relative || edited.absolute}:\n${output || `exit ${result.status}`}`,
  );
}
process.exit(0);
