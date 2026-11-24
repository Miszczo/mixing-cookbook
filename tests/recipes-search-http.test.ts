/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const PASSWORD = "Recipe-Search-Passw0rd!";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const OWN_INTENT = "Czyszczenie dołu w wokalu";
const STARTER_INTENT = "Sidechain stopy z basem";
const NO_MATCHES = "No recipes match your search.";

type Jar = Map<string, string>;

function cookieHeader(jar: ReadonlyMap<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

describe("recipe search", () => {
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

  async function user(tag: string): Promise<Jar> {
    const jar: Jar = new Map();
    await signIn(origin, jar, `recipes-search-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`, PASSWORD);
    return jar;
  }

  async function postRecipe(jar: Jar, intent: string, requiredType: string): Promise<number> {
    const form = new FormData();
    form.set("intent", intent);
    form.set("required_type", requiredType);
    form.set("steps", "Wytnij dół poniżej 100 Hz.");
    form.set("image", new File([Buffer.from(PNG)], "shot.png", { type: "application/octet-stream" }));
    const response = await fetch(new URL("/recipes/new", origin), {
      method: "POST",
      redirect: "manual",
      headers: { origin, cookie: cookieHeader(jar) },
      body: form,
    });
    await response.body?.cancel();
    return response.status;
  }

  it("filters on the server and never shows another user's recipes", async () => {
    const a = await user("a");
    expect(await postRecipe(a, OWN_INTENT, "eq")).toBe(303);

    const byIntent = await request(origin, a, "/recipes?q=dol+wokal");
    expect(byIntent.status).toBe(200);
    expect(byIntent.body).toContain(OWN_INTENT);
    expect(byIntent.body).not.toContain(STARTER_INTENT);

    const starters = await request(origin, a, "/recipes?source=starter");
    expect(starters.status).toBe(200);
    expect(starters.body).toContain(STARTER_INTENT);
    expect(starters.body).not.toContain(OWN_INTENT);

    const compressors = await request(origin, a, "/recipes?type=compressor");
    expect(compressors.status).toBe(200);
    expect(compressors.body).not.toContain(OWN_INTENT);

    const b = await user("b");
    const foreign = await request(origin, b, "/recipes?q=dol+wokal");
    expect(foreign.status).toBe(200);
    expect(foreign.body).not.toContain(OWN_INTENT);
    expect(foreign.body).toContain(NO_MATCHES);

    const anonymous = await request(origin, new Map(), "/recipes?q=x");
    expect(anonymous.status).toBe(302);
    expect(anonymous.locationPath).toBe("/auth/signin");
  }, 90_000);
});
