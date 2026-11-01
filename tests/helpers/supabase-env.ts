import { readFileSync } from "node:fs";

function fillUnsetFromRepoEnv(names: readonly string[]): void {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length === 0) return;

  let text: string;
  try {
    text = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  } catch {
    return;
  }

  const found = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!missing.includes(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) found.set(key, value);
  }

  for (const name of missing) {
    const value = found.get(name);
    if (value) process.env[name] = value;
  }
}

export function requireAnonEnv(): { url: string; key: string } {
  fillUnsetFromRepoEnv(["SUPABASE_URL", "SUPABASE_KEY"]);
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? "";
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
  }
  return { url, key };
}
