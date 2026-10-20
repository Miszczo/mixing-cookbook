/// <reference types="vitest/globals" />
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const astroBin = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));
const authenticatedSentence = "This page is only for authenticated users.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function reservePort(): Promise<number> {
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

function startApp(port: number): ChildProcess {
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

function watchForLocalUrl(child: ChildProcess): Promise<string> {
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
  const lockPath = fileURLToPath(new URL("../.astro/dev.json", import.meta.url));
  try {
    const raw = JSON.parse(readFileSync(lockPath, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null || !("pid" in raw) || raw.pid !== pid) return;
    unlinkSync(lockPath);
  } catch {
    // The lock is already gone, or it belongs to another server.
  }
}

async function stopApp(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid) return;
  const pid = child.pid;

  if (child.exitCode === null) {
    const exited = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 8_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => {
        child.kill();
      });
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

interface HttpResult {
  status: number;
  locationPath: string;
  body: string;
}

async function request(
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
    locationPath: locationPath(response.headers.get("location") ?? "", origin),
    body: await response.text(),
  };
}

function readProbeId(body: string): string {
  const parsed = JSON.parse(body) as unknown;
  if (typeof parsed !== "object" || parsed === null || !("id" in parsed)) {
    throw new Error("POST /api/isolation/probes did not return an id");
  }
  const id = parsed.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("POST /api/isolation/probes did not return an id");
  }
  return id;
}

async function signIn(origin: string, jar: Map<string, string>, email: string, password: string): Promise<void> {
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

async function waitForHttp(origin: string): Promise<void> {
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

describe("HTTP dashboard and probe gates", () => {
  let child: ChildProcess | undefined;
  let origin = "";

  beforeAll(async () => {
    const port = await reservePort();
    child = startApp(port);
    origin = await watchForLocalUrl(child);
    await waitForHttp(origin);
  }, 120_000);

  afterAll(async () => {
    await stopApp(child);
  }, 20_000);

  it("gates the dashboard and isolation probes over cookie sessions", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Http-Access-Passw0rd!";
    const emailA = `http-a-${stamp}@example.com`;
    const emailB = `http-b-${stamp}@example.com`;
    const note = `http-note-${stamp}`.slice(0, 200);

    const owner = new Map<string, string>();
    await signIn(origin, owner, emailA, password);

    const created = await request(origin, owner, "/api/isolation/probes", {
      method: "POST",
      json: { note },
    });
    expect(created.status).toBe(201);
    const probeId = readProbeId(created.body);

    const ownerList = await request(origin, owner, "/api/isolation/probes");
    expect(ownerList.status).toBe(200);
    expect(ownerList.body).toContain(note);

    const signedOut = new Map<string, string>();
    const dashboard = await request(origin, signedOut, "/dashboard");
    expect(dashboard.status).toBe(302);
    expect(dashboard.locationPath).toBe("/auth/signin");
    expect(dashboard.body).not.toContain(authenticatedSentence);

    const anonymous = new Map<string, string>();
    const anonymousList = await request(origin, anonymous, "/api/isolation/probes");
    expect(anonymousList.status).toBe(401);
    expect(anonymousList.body).not.toContain(note);

    const other = new Map<string, string>();
    await signIn(origin, other, emailB, password);
    const otherList = await request(origin, other, "/api/isolation/probes");
    expect(otherList.status).toBe(200);
    expect(otherList.body).not.toContain(note);

    const byId = await request(origin, other, `/api/isolation/probes/${probeId}`);
    expect(byId.status).toBe(404);
    expect(byId.body).not.toContain(note);
  }, 60_000);
});
