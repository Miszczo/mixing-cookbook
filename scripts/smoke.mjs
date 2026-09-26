// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Also proves owner isolation and shared catalog read via /api/isolation/*.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const emailB = `smoke-b-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();
let probeIdA = null;

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, json } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  storeCookies(response);

  let body = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  return { status: response.status, location: response.headers.get("location") ?? "", body };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["anonymous GET probes returns 401", () => request("/api/isolation/probes"), { status: 401 }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  [
    "user A POST probes owned-by-a returns 201",
    async () => {
      const actual = await request("/api/isolation/probes", {
        method: "POST",
        json: { note: "owned-by-a" },
      });
      if (typeof actual.body?.id === "string") probeIdA = actual.body.id;
      return actual;
    },
    { status: 201, check: (actual) => typeof actual.body?.id === "string" },
  ],
  [
    "user A GET probes contains owned id",
    () => request("/api/isolation/probes"),
    {
      status: 200,
      check: (actual) => Array.isArray(actual.body?.probes) && actual.body.probes.some((p) => p.id === probeIdA),
    },
  ],
  [
    "user A GET catalog starter-visible",
    () => request("/api/isolation/catalog"),
    {
      status: 200,
      check: (actual) =>
        Array.isArray(actual.body?.items) && actual.body.items.some((item) => item.label === "starter-visible"),
    },
  ],
  ["user A POST catalog returns 403", () => request("/api/isolation/catalog", { method: "POST" }), { status: 403 }],
  ["user A signs out", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  [
    "user B signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email: emailB, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "user B signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email: emailB, password } }),
    { status: 302, location: "/" },
  ],
  [
    "user B GET probes B-misses-A",
    () => request("/api/isolation/probes"),
    {
      status: 200,
      check: (actual) => Array.isArray(actual.body?.probes) && !actual.body.probes.some((p) => p.id === probeIdA),
    },
  ],
  ["user B GET probes by A id returns 404", () => request(`/api/isolation/probes/${probeIdA}`), { status: 404 }],
  [
    "user B GET catalog starter-visible",
    () => request("/api/isolation/catalog"),
    {
      status: 200,
      check: (actual) =>
        Array.isArray(actual.body?.items) && actual.body.items.some((item) => item.label === "starter-visible"),
    },
  ],
  ["user B POST catalog returns 403", () => request("/api/isolation/catalog", { method: "POST" }), { status: 403 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  if (typeof probeIdA !== "string" && name.startsWith("user B GET probes")) {
    console.log(`FAIL  ${name}  -> missing probe id from user A`);
    failed++;
    break;
  }
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location)) &&
    (expected.check === undefined || expected.check(actual));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
