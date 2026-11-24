/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const PASSWORD = "Recipe-Http-Passw0rd!";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

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

describe("own recipes", () => {
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
    await signIn(origin, jar, `recipes-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`, PASSWORD);
    return jar;
  }

  const shared = new Map<string, Promise<Jar>>();
  function sharedUser(tag: string): Promise<Jar> {
    let jar = shared.get(tag);
    if (!jar) {
      jar = user(tag);
      shared.set(tag, jar);
    }
    return jar;
  }

  async function postRecipe(
    jar: Jar,
    fields: { intent: string; required_type: string; steps: string },
    file?: { name: string; bytes: Uint8Array },
  ) {
    const form = new FormData();
    form.set("intent", fields.intent);
    form.set("required_type", fields.required_type);
    form.set("steps", fields.steps);
    if (file) {
      form.set("image", new File([Buffer.from(file.bytes)], file.name, { type: "application/octet-stream" }));
    }
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
    return {
      status: response.status,
      locationPath: response.headers.get("location")
        ? new URL(response.headers.get("location") ?? "", origin).pathname
        : "",
      body: await response.text(),
    };
  }

  it("saves a recipe, serves the image only to its owner, and deletes it", async () => {
    const owner = await sharedUser("owner");
    const intent = `Vocal sidechain ${crypto.randomUUID()}`;
    const saved = await postRecipe(
      owner,
      { intent, required_type: "eq", steps: "Cut the mud.\nTame the resonance." },
      { name: "shot.png", bytes: PNG },
    );
    expect(saved.status).toBe(303);
    expect(saved.locationPath).toBe("/recipes");

    const list = await request(origin, owner, "/recipes");
    expect(list.status).toBe(200);
    expect(list.body).toContain(intent);
    expect(list.body).toContain("EQ");
    expect(list.body).toContain("2 steps");
    const id = recipeId(list.body, intent);

    const image = await fetch(new URL(`/api/recipes/${id}/image`, origin), {
      headers: { cookie: cookieHeader(owner) },
    });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer()).equals(Buffer.from(PNG))).toBe(true);

    const other = await sharedUser("other");
    const foreign = await fetch(new URL(`/api/recipes/${id}/image`, origin), {
      headers: { cookie: cookieHeader(other) },
    });
    expect(foreign.status).toBe(404);

    const anonymous = await fetch(new URL(`/api/recipes/${id}/image`, origin));
    expect(anonymous.status).toBe(401);

    const deleted = await request(origin, owner, `/api/recipes/${id}`, {
      method: "POST",
      form: { action: "delete" },
    });
    expect(deleted.status).toBe(303);
    expect(deleted.locationPath).toBe("/recipes");

    const gone = await fetch(new URL(`/api/recipes/${id}/image`, origin), {
      headers: { cookie: cookieHeader(owner) },
    });
    expect(gone.status).toBe(404);
  }, 60_000);

  it("serves the new recipe form with the file input and the paste hooks", async () => {
    const jar = await sharedUser("owner");
    const page = await request(origin, jar, "/recipes/new");
    expect(page.status).toBe(200);
    expect(page.body).toContain('type="file"');
    expect(page.body).toContain('name="image"');
    expect(page.body).toContain('data-max-bytes="1048576"');
    expect(page.body).toContain('id="recipe-image-status"');
    expect(page.body).toContain('role="status"');
    expect(page.body).toContain("Save recipe");
  }, 60_000);

  it("returns 413 for a file over 1 MB and keeps the typed text", async () => {
    const jar = await sharedUser("owner");
    const intent = "Too big to store";
    const steps = "Leave this line in the form.";
    const saved = await postRecipe(
      jar,
      { intent, required_type: "compressor", steps },
      { name: "big.png", bytes: new Uint8Array(1_048_576 + 1) },
    );
    expect(saved.status).toBe(413);
    expect(saved.body).toContain("paste");
    expect(saved.body).toContain(intent);
    expect(saved.body).toContain(steps);
    expect(saved.body).toContain('role="alert"');
  }, 60_000);

  it("returns 400 for a text file named png and keeps the typed text", async () => {
    const jar = await sharedUser("owner");
    const intent = "Not really a picture";
    const steps = "Keep this step too.";
    const saved = await postRecipe(
      jar,
      { intent, required_type: "reverb", steps },
      { name: "notes.png", bytes: new TextEncoder().encode("this is text, not a png") },
    );
    expect(saved.status).toBe(400);
    expect(saved.body).toContain("paste");
    expect(saved.body).toContain(intent);
    expect(saved.body).toContain(steps);
    expect(saved.body).toContain('role="alert"');
  }, 60_000);

  it("returns 400 when the image and the steps are missing", async () => {
    const jar = await sharedUser("owner");
    const saved = await postRecipe(jar, { intent: "Nothing to do", required_type: "delay", steps: " \n\t " });
    expect(saved.status).toBe(400);
    expect(saved.body).toContain("Nothing to do");
    expect(saved.body).toContain("paste");
    expect(saved.body).toContain('role="alert"');
  }, 60_000);
});
