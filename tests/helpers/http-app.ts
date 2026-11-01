import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const astroBin = fileURLToPath(new URL("../../node_modules/astro/bin/astro.mjs", import.meta.url));

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => {
          reject(new Error("could not reserve a port"));
        });
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function chunkText(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return "";
}

function stripAnsi(text: string): string {
  const esc = String.fromCharCode(27);
  if (!text.includes(esc)) return text;
  return text
    .split(esc)
    .map((part, index) => {
      if (index === 0) return part;
      const end = part.indexOf("m");
      return end === -1 ? part : part.slice(end + 1);
    })
    .join("");
}

function safeTail(log: string): string {
  const tail = log.slice(-400).replace(/\s+/g, " ").trim();
  if (/supabase|eyJ|service_role/i.test(tail)) return "startup log omitted";
  return tail;
}

export function startApp(port: number): ChildProcess {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (name === "VITEST" || name === "VITEST_POOL_ID" || name === "VITEST_WORKER_ID" || name === "VITEST_MODE") {
      continue;
    }
    env[name] = value;
  }
  env.ASTRO_TELEMETRY_DISABLED = "1";
  // Keeps `astro dev` in this process when an agent environment would otherwise detach it.
  env.ASTRO_DEV_BACKGROUND = "1";

  return spawn(process.execPath, [astroBin, "dev", "--port", String(port), "--host", "127.0.0.1"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
}

export function watchForLocalUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let log = "";
    let settled = false;
    const settle = (error?: Error, url?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (url) resolve(url);
      else reject(error ?? new Error("astro dev did not print a local URL"));
    };
    const timer = setTimeout(() => {
      settle(new Error(`astro dev did not print a local URL (${safeTail(log)})`));
    }, 90_000);

    const onData = (chunk: unknown) => {
      log += stripAnsi(chunkText(chunk));
      if (log.length > 12_000) log = log.slice(-12_000);
      const match = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+/.exec(log);
      const url = match?.[0];
      if (url) settle(undefined, url.replace(/\/$/, ""));
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", (code) => {
      settle(new Error(`astro dev exited with code ${code ?? "null"} before it was ready (${safeTail(log)})`));
    });
  });
}

function removeOwnLock(pid: number): void {
  const lockPath = fileURLToPath(new URL("../../.astro/dev.json", import.meta.url));
  try {
    const raw = JSON.parse(readFileSync(lockPath, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null || !("pid" in raw) || raw.pid !== pid) return;
    unlinkSync(lockPath);
  } catch {
    // The lock is already gone, or it belongs to another server.
  }
}

export async function stopApp(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid) return;
  const pid = child.pid;

  if (child.exitCode === null) {
    const exited = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`astro dev pid ${pid} was still running after stop`));
      }, 8_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    if (process.platform === "win32") {
      const code = await new Promise<number | null>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.once("error", () => {
          child.kill();
          resolve(null);
        });
        killer.once("exit", (exitCode) => {
          resolve(exitCode);
        });
      });
      if (code !== 0) {
        child.kill();
      }
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }

    await exited;
  }

  removeOwnLock(pid);
}

function cookieHeader(jar: ReadonlyMap<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(jar: Map<string, string>, response: Response): void {
  for (const raw of response.headers.getSetCookie()) {
    const [pair = "", ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    const expired = attrs.some((attr) => /max-age=0/i.test(attr.trim()));
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
}

function locationPath(location: string, origin: string): string {
  if (location.length === 0) return "";
  return new URL(location, origin).pathname;
}

export interface HttpResult {
  status: number;
  location: string;
  locationPath: string;
  body: string;
}

export async function request(
  origin: string,
  jar: Map<string, string>,
  path: string,
  init: { method?: string; form?: Record<string, string>; json?: unknown } = {},
): Promise<HttpResult> {
  const headers = new Headers();
  headers.set("origin", origin);
  const cookie = cookieHeader(jar);
  if (cookie.length > 0) headers.set("cookie", cookie);

  let body: string | undefined;
  if (init.form) {
    headers.set("content-type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(init.form).toString();
  } else if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }

  const response = await fetch(new URL(path, origin), {
    method: init.method ?? "GET",
    redirect: "manual",
    headers,
    body,
  });
  storeCookies(jar, response);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    locationPath: locationPath(response.headers.get("location") ?? "", origin),
    body: await response.text(),
  };
}

export async function signIn(origin: string, jar: Map<string, string>, email: string, password: string): Promise<void> {
  const signup = await request(origin, jar, "/api/auth/signup", {
    method: "POST",
    form: { email, password },
  });
  if (signup.status !== 302) {
    throw new Error(`signup failed with status ${signup.status}`);
  }

  const signin = await request(origin, jar, "/api/auth/signin", {
    method: "POST",
    form: { email, password },
  });
  if (signin.status !== 302 || signin.locationPath !== "/") {
    throw new Error(`signin failed with status ${signin.status} location ${signin.locationPath}`);
  }
}

export async function waitForHttp(origin: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/", origin), { redirect: "manual" });
      await response.body?.cancel();
      if (response.status < 500) return;
      lastError = `status ${response.status}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    await delay(250);
  }
  throw new Error(`astro dev was not ready: ${lastError}`);
}
