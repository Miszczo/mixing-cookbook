/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";
import { requireAnonEnv } from "./helpers/supabase-env";

const { url, key } = requireAnonEnv();
const PASSWORD = "Recipe-Http-Passw0rd!";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const STARTER = "sidechain-kick-bass";

type Jar = Map<string, string>;

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

function recipeId(body: string, intent: string): string {
  const id = new RegExp(`${intent}[\\s\\S]*?/api/recipes/([0-9a-f-]{36})/image`).exec(body)?.[1];
  if (!id) throw new Error(`no recipe image for ${intent}`);
  return id;
}

function trackId(trackPath: string): string {
  const id = /\/tracks\/([0-9a-f-]{36})/.exec(trackPath)?.[1];
  if (!id) throw new Error(`no track id in ${trackPath}`);
  return id;
}

function activeTool(body: string): string | undefined {
  return /data-testid="recipe-tool"[^>]*>([^<]*)</.exec(body)?.[1]?.trim();
}

function pluginIdFromCard(body: string, name: string): string {
  const id = new RegExp(`<option[^>]*value="([0-9a-f-]{36})"[^>]*>[^<]*${name}`).exec(body)?.[1];
  if (!id) throw new Error(`no option for ${name}`);
  return id;
}

async function progressRecipeIds(email: string, id: string): Promise<string[]> {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw signed.error;
  const rows = await client.from("track_recipe_progress").select("recipe_id").eq("track_id", id);
  if (rows.error) throw rows.error;
  return rows.data.map((row) => row.recipe_id as string);
}

describe("own recipe on a track", () => {
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

  async function user(tag: string): Promise<{ jar: Jar; email: string }> {
    const jar: Jar = new Map();
    const email = `in-track-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`;
    await signIn(origin, jar, email, PASSWORD);
    return { jar, email };
  }

  async function postRecipe(jar: Jar, fields: { intent: string; required_type: string; steps: string }) {
    const form = new FormData();
    form.set("intent", fields.intent);
    form.set("required_type", fields.required_type);
    form.set("steps", fields.steps);
    form.set("image", new File([Buffer.from(PNG)], "shot.png", { type: "application/octet-stream" }));
    const headers = new Headers();
    headers.set("origin", origin);
    const cookie = cookieHeader(jar);
    if (cookie.length > 0) headers.set("cookie", cookie);
    const response = await fetch(new URL("/recipes/new", origin), {
      method: "POST",
      redirect: "manual",
      headers,
      body: form,
    });
    storeCookies(jar, response);
    return response.status;
  }

  it("lists an own recipe on a Miks track, keeps a toggled step, and drops it with its progress", async () => {
    const owner = await user("owner");
    const intent = `Vocal air ${crypto.randomUUID()}`;
    const saved = await postRecipe(owner.jar, {
      intent,
      required_type: "eq",
      steps: "Cut the mud.\nTame the resonance.",
    });
    expect(saved).toBe(303);

    const library = await request(origin, owner.jar, "/recipes");
    const id = recipeId(library.body, intent);

    const created = await request(origin, owner.jar, "/api/tracks", {
      method: "POST",
      form: { name: "Track A", stage: "miks" },
    });
    expect(created.status).toBe(303);
    const trackPath = created.location;

    const list = await request(origin, owner.jar, trackPath);
    expect(list.status).toBe(200);
    expect(list.body).toContain("Potrzebuję przepisu");
    const starterAt = list.body.indexOf(`${trackPath}?recipe=${STARTER}`);
    const ownAt = list.body.indexOf(`${trackPath}?recipe=${id}`);
    expect(starterAt).toBeGreaterThanOrEqual(0);
    expect(ownAt).toBeGreaterThan(starterAt);
    expect(activeTool(list.body)).toBeUndefined();

    const card = await request(origin, owner.jar, `${trackPath}?recipe=${id}`);
    expect(activeTool(card.body)).toBe("natywne narzędzie Twojego DAW (EQ)");
    expect(card.body).toContain(intent);
    expect(card.body).toContain("Cut the mud.");
    expect(card.body).toContain("Tame the resonance.");
    expect(card.body).toContain(`src="/api/recipes/${id}/image"`);
    expect(card.body).toMatch(/data-step="step-1"/);
    expect(card.body).toMatch(/data-step="step-2"/);

    const plugin = await request(origin, owner.jar, "/api/plugins", {
      method: "POST",
      form: { name: "Air EQ", plugin_type: "eq" },
    });
    expect(plugin.status).toBe(303);
    const withPlugin = await request(origin, owner.jar, `${trackPath}?recipe=${id}`);
    expect(activeTool(withPlugin.body)).toBe("Air EQ");
    const pluginId = pluginIdFromCard(withPlugin.body, "Air EQ");
    expect(pluginId).toMatch(/^[0-9a-f-]{36}$/);

    const checked = await request(origin, owner.jar, `/api${trackPath}/recipes/${id}`, {
      method: "POST",
      form: { action: "toggle-step", step: "step-1", done: "true" },
    });
    expect(checked.status).toBe(303);
    expect(checked.location).toBe(`${trackPath}?recipe=${id}`);

    const reloaded = await request(origin, owner.jar, `${trackPath}?recipe=${id}`);
    expect(reloaded.body).toMatch(/data-step="step-1"[^>]*aria-pressed="true"/);
    expect(reloaded.body).toMatch(/data-step="step-2"[^>]*aria-pressed="false"/);
    expect(await progressRecipeIds(owner.email, trackId(trackPath))).toEqual([id]);

    const other = await user("other");
    const foreignTrack = await request(origin, other.jar, "/api/tracks", {
      method: "POST",
      form: { name: "Theirs", stage: "miks" },
    });
    expect(foreignTrack.status).toBe(303);
    const foreignRead = await request(origin, owner.jar, foreignTrack.location);
    expect(foreignRead.status).toBe(404);
    const hiddenIntent = `Hidden ${crypto.randomUUID()}`;
    const foreignRecipe = await postRecipe(other.jar, {
      intent: hiddenIntent,
      required_type: "eq",
      steps: "Leave it.",
    });
    expect(foreignRecipe).toBe(303);
    const hiddenId = recipeId((await request(origin, other.jar, "/recipes")).body, hiddenIntent);
    const foreignWrite = await request(origin, owner.jar, `/api${trackPath}/recipes/${hiddenId}`, {
      method: "POST",
      form: { action: "toggle-step", step: "step-1", done: "true" },
    });
    expect(foreignWrite.status).toBe(404);
    const otherRead = await request(origin, other.jar, `${trackPath}?recipe=${id}`);
    expect(otherRead.status).toBe(404);

    const deleted = await request(origin, owner.jar, `/api/recipes/${id}`, {
      method: "POST",
      form: { action: "delete" },
    });
    expect(deleted.status).toBe(303);

    const after = await request(origin, owner.jar, trackPath);
    expect(after.body).not.toContain(intent);
    expect(after.body).not.toContain(`/api/recipes/${id}/image`);
    expect(activeTool(after.body)).toBeUndefined();
    expect(await progressRecipeIds(owner.email, trackId(trackPath))).toEqual([]);
  }, 60_000);
});
