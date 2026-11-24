/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const RECIPE = "sidechain-kick-bass";
const FIRST_STEP = "Wstaw kompresor na ślad basu.";
const LAST_STEP = "Sprawdź efekt w całym miksie, włączając i wyłączając kompresor.";
const SIX_STEPS = 6;
const PASSWORD = "Recipe-Http-Passw0rd!";

type Jar = Map<string, string>;

function activeTool(body: string): string | undefined {
  return /data-testid="recipe-tool"[^>]*>([^<]*)</.exec(body)?.[1]?.trim();
}

function pluginIdFromCard(body: string, name: string): string {
  const id = new RegExp(`<option[^>]*value="([0-9a-f-]{36})"[^>]*>[^<]*${name}`).exec(body)?.[1];
  if (!id) throw new Error(`no option for ${name}`);
  return id;
}

function stepCount(body: string): number {
  return body.match(/data-step="/g)?.length ?? 0;
}

describe("recipe card on a track", () => {
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
    await signIn(origin, jar, `recipe-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`, PASSWORD);
    return jar;
  }

  // Sign-ups share a per-IP rate limit with the other integration files, so tests that need
  // the same account state reuse one user. Each test still works on its own track.
  const shared = new Map<string, Promise<Jar>>();
  function sharedUser(tag: string): Promise<Jar> {
    let jar = shared.get(tag);
    if (!jar) {
      jar = user(tag);
      shared.set(tag, jar);
    }
    return jar;
  }

  async function setDaw(jar: Jar, dawId: string) {
    const saved = await request(origin, jar, "/api/profile/primary-daw", { method: "POST", form: { daw_id: dawId } });
    expect(saved.status).toBe(303);
  }

  async function addPlugin(jar: Jar, name: string) {
    const created = await request(origin, jar, "/api/plugins", {
      method: "POST",
      form: { name, plugin_type: "compressor" },
    });
    expect(created.status).toBe(303);
  }

  async function addTrack(jar: Jar, stage: string): Promise<string> {
    const created = await request(origin, jar, "/api/tracks", { method: "POST", form: { name: "Track A", stage } });
    expect(created.status).toBe(303);
    return created.location;
  }

  const openCard = async (jar: Jar, trackPath: string) =>
    (await request(origin, jar, `${trackPath}?recipe=${RECIPE}`)).body;

  const post = (jar: Jar, trackPath: string, form: Record<string, string>) =>
    request(origin, jar, `/api${trackPath}/recipes/${RECIPE}`, { method: "POST", form });

  it("offers the recipe on a Miks track and names the DAW's native tool with no plugins", async () => {
    // "bare": never gets plugins, sets its own DAW.
    const jar = await sharedUser("bare");
    await setDaw(jar, "reaper");
    const trackPath = await addTrack(jar, "miks");

    const page = (await request(origin, jar, trackPath)).body;
    expect(page).toContain("Potrzebuję przepisu");
    expect(page).toContain(`${trackPath}?recipe=${RECIPE}`);
    expect(page).toContain("Sidechain stopy z basem");
    expect(activeTool(page)).toBeUndefined();

    const card = await openCard(jar, trackPath);
    expect(activeTool(card)).toBe("ReaComp");
    expect(stepCount(card)).toBe(SIX_STEPS);
    expect(card).toContain(FIRST_STEP);
    expect(card).toContain(LAST_STEP);
    expect(card).toContain('src="/recipes/sidechain-settings-mock.png"');

    const image = await fetch(new URL("/recipes/sidechain-settings-mock.png", origin));
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toContain("image/png");
  }, 60_000);

  it("renders the copy-as-Markdown button with its data, status and fallback field", async () => {
    const jar = await sharedUser("bare");
    const trackPath = await addTrack(jar, "miks");

    const card = await openCard(jar, trackPath);
    const buttonTag = /<button\b[^>]*\bid="recipe-copy-markdown"[^>]*>/.exec(card)?.[0];
    expect(buttonTag).toBeDefined();
    expect(buttonTag).toMatch(/\btype="button"/);
    expect(buttonTag).toMatch(/\bdata-markdown="## /);
    expect(card).toMatch(/<p\b[^>]*\bid="recipe-copy-status"/);
    expect(card).toMatch(/<textarea\b[^>]*\bid="recipe-copy-fallback"/);
  }, 60_000);

  it("shows a generic native tool and a dashboard link with no plugins and no DAW", async () => {
    // "plain": never sets a DAW and never gets plugins.
    const jar = await sharedUser("plain");
    const trackPath = await addTrack(jar, "miks");

    const card = await openCard(jar, trackPath);
    expect(activeTool(card)).toBe("natywny kompresor Twojego DAW");
    expect(card).toContain('href="/dashboard"');
    expect(stepCount(card)).toBe(SIX_STEPS);
    expect(card).toContain('src="/recipes/sidechain-settings-mock.png"');
  }, 60_000);

  it("suggests a favorite ahead of an alphabetically earlier plugin, and any plugin ahead of native", async () => {
    const jar = await user("favorite");
    await setDaw(jar, "fl-studio");
    const trackPath = await addTrack(jar, "miks");

    await addPlugin(jar, "Alpha Comp");
    await addPlugin(jar, "Zeta Comp");
    const before = await openCard(jar, trackPath);
    expect(activeTool(before)).toBe("Alpha Comp");
    expect(before).toContain("Fruity Limiter (sekcja kompresji) (native)");

    const zeta = pluginIdFromCard(before, "Zeta Comp");
    const favorite = await request(origin, jar, `/api/plugins/${zeta}`, {
      method: "POST",
      form: { action: "favorite", is_favorite: "true" },
    });
    expect(favorite.status).toBe(303);

    const after = await openCard(jar, trackPath);
    expect(activeTool(after)).toBe("Zeta Comp");
    expect(after).toContain("★ Zeta Comp");
  }, 60_000);

  it("keeps a checked step and a chosen tool across fresh reads without either clearing the other", async () => {
    const jar = await user("persist");
    await setDaw(jar, "logic-pro");
    const trackPath = await addTrack(jar, "miks");
    await addPlugin(jar, "Alpha Comp");
    await addPlugin(jar, "Beta Comp");
    const beta = pluginIdFromCard(await openCard(jar, trackPath), "Beta Comp");

    const checked = await post(jar, trackPath, { action: "toggle-step", step: "threshold", done: "true" });
    expect(checked.status).toBe(303);
    expect(checked.location).toBe(`${trackPath}?recipe=${RECIPE}`);

    const chosen = await post(jar, trackPath, { action: "choose-tool", tool: beta });
    expect(chosen.status).toBe(303);

    // No recipe parameter: stored progress alone opens the card.
    const reread = (await request(origin, jar, trackPath)).body;
    expect(activeTool(reread)).toBe("Beta Comp");
    expect(reread).toMatch(/data-step="threshold"[^>]*aria-pressed="true"/);
    expect(reread).toMatch(/data-step="release"[^>]*aria-pressed="false"/);

    await post(jar, trackPath, { action: "toggle-step", step: "release", done: "true" });
    await post(jar, trackPath, { action: "toggle-step", step: "threshold", done: "false" });
    const toggled = (await request(origin, jar, trackPath)).body;
    expect(activeTool(toggled)).toBe("Beta Comp");
    expect(toggled).toMatch(/data-step="threshold"[^>]*aria-pressed="false"/);
    expect(toggled).toMatch(/data-step="release"[^>]*aria-pressed="true"/);

    await post(jar, trackPath, { action: "choose-tool", tool: "native" });
    const native = (await request(origin, jar, trackPath)).body;
    expect(activeTool(native)).toBe("Compressor");
    expect(native).toMatch(/data-step="release"[^>]*aria-pressed="true"/);

    await post(jar, trackPath, { action: "choose-tool", tool: beta });
    const removed = await request(origin, jar, `/api/plugins/${beta}`, { method: "POST", form: { action: "delete" } });
    expect(removed.status).toBe(303);
    expect(activeTool((await request(origin, jar, trackPath)).body)).toBe("Alpha Comp");
  }, 60_000);

  it("shows no recipe outside Miks, refuses writes there, and restores progress on return", async () => {
    const jar = await sharedUser("bare");
    await setDaw(jar, "bitwig-studio");
    const trackPath = await addTrack(jar, "miks");
    await post(jar, trackPath, { action: "toggle-step", step: "route-kick", done: "true" });

    for (const stage of ["aranz", "master"]) {
      await request(origin, jar, `/api${trackPath}`, { method: "POST", form: { name: "Track A", stage } });
      const page = await openCard(jar, trackPath);
      expect(page).not.toContain("Potrzebuję przepisu");
      expect(activeTool(page)).toBeUndefined();
      expect(stepCount(page)).toBe(0);
      expect(page).toContain("Switch this track to Miks");

      const refused = await post(jar, trackPath, { action: "toggle-step", step: "threshold", done: "true" });
      expect(refused.status).toBe(303);
      expect(refused.location).toBe(trackPath);
    }

    await request(origin, jar, `/api${trackPath}`, { method: "POST", form: { name: "Track A", stage: "miks" } });
    const back = (await request(origin, jar, trackPath)).body;
    expect(activeTool(back)).toBe("Compressor");
    expect(back).toMatch(/data-step="route-kick"[^>]*aria-pressed="true"/);
    expect(back).toMatch(/data-step="threshold"[^>]*aria-pressed="false"/);
  }, 60_000);

  it("rejects anonymous callers and another user's reads and writes", async () => {
    const owner = await sharedUser("plain");
    const trackPath = await addTrack(owner, "miks");
    await post(owner, trackPath, { action: "toggle-step", step: "route-kick", done: "true" });

    const anonymous: Jar = new Map();
    const anonymousPost = await post(anonymous, trackPath, { action: "toggle-step", step: "release", done: "true" });
    expect(anonymousPost.status).toBe(401);

    const other = await sharedUser("foreign");
    const foreignRead = await request(origin, other, `${trackPath}?recipe=${RECIPE}`);
    expect(foreignRead.status).toBe(404);
    expect(foreignRead.body).not.toContain(FIRST_STEP);
    const foreignWrite = await post(other, trackPath, { action: "toggle-step", step: "release", done: "true" });
    expect(foreignWrite.status).toBe(404);

    const after = (await request(origin, owner, trackPath)).body;
    expect(after).toMatch(/data-step="route-kick"[^>]*aria-pressed="true"/);
    expect(after).toMatch(/data-step="release"[^>]*aria-pressed="false"/);

    const unknownRecipe = await request(origin, owner, `/api${trackPath}/recipes/no-such-recipe`, {
      method: "POST",
      form: { action: "toggle-step", step: "release", done: "true" },
    });
    expect(unknownRecipe.status).toBe(404);
  }, 60_000);

  it("writes nothing for an invalid step, tool, foreign plugin, or non-form body", async () => {
    const jar = await user("invalid");
    await setDaw(jar, "ableton-live");
    const trackPath = await addTrack(jar, "miks");
    await addPlugin(jar, "Alpha Comp");

    const other = await sharedUser("foreign");
    const otherTrack = await addTrack(other, "miks");
    await addPlugin(other, "Foreign Comp");
    const foreignPlugin = pluginIdFromCard(await openCard(other, otherTrack), "Foreign Comp");

    const invalidTarget = `${trackPath}?recipe=${RECIPE}&error=invalid_recipe_action`;
    const attempts = [
      await post(jar, trackPath, { action: "toggle-step", step: "not-a-step", done: "true" }),
      await post(jar, trackPath, { action: "toggle-step", step: "release", done: "maybe" }),
      await post(jar, trackPath, { action: "choose-tool", tool: "not-a-tool" }),
      await post(jar, trackPath, { action: "choose-tool", tool: foreignPlugin }),
      await request(origin, jar, `/api${trackPath}/recipes/${RECIPE}`, {
        method: "POST",
        json: { action: "toggle-step" },
      }),
    ];
    for (const attempt of attempts) {
      expect(attempt.status).toBe(303);
      expect(attempt.location).toBe(invalidTarget);
    }

    const shown = await request(origin, jar, invalidTarget);
    expect(shown.body).toContain('role="alert"');
    expect(activeTool(shown.body)).toBe("Alpha Comp");
    expect(shown.body).not.toMatch(/aria-pressed="true"/);
    // No write happened, so no stored row reopens the card without the parameter.
    expect(activeTool((await request(origin, jar, trackPath)).body)).toBeUndefined();
  }, 60_000);
});
