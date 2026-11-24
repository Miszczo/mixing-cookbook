/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const missingUuid = "00000000-0000-4000-8000-000000000000";

function idAfter(body: string, prefix: string, name: string): string {
  const namePosition = body.indexOf(`value="${name}"`);
  const before = body.slice(0, namePosition);
  const start = before.lastIndexOf(prefix) + prefix.length;
  return before.slice(start, start + 36);
}

describe("plugins and tracks", () => {
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

  it("keeps plugin CRUD private to its owner", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Plugin-Http-Passw0rd!";
    const name = `Pro-C ${stamp}`;

    const anonymous = new Map<string, string>();
    const anonymousPage = await request(origin, anonymous, "/plugins");
    expect(anonymousPage.status).toBe(302);
    expect(anonymousPage.locationPath).toBe("/auth/signin");
    const anonymousPost = await request(origin, anonymous, "/api/plugins", {
      method: "POST",
      form: { name, plugin_type: "compressor" },
    });
    expect(anonymousPost.status).toBe(401);

    const owner = new Map<string, string>();
    await signIn(origin, owner, `plugin-a-${stamp}@example.com`, password);

    const rejected = await request(origin, owner, "/api/plugins", {
      method: "POST",
      form: { name: "Typed name", plugin_type: "not-a-type" },
    });
    expect(rejected.status).toBe(303);
    const afterRejected = await request(origin, owner, rejected.location);
    expect(afterRejected.body).toContain('value="Typed name"');
    expect(afterRejected.body).toContain("No plugins yet.");

    const splitEmoji = await request(origin, owner, "/api/plugins", {
      method: "POST",
      form: { name: `${"a".repeat(99)}😀`, plugin_type: "compressor" },
    });
    expect(splitEmoji.status).toBe(303);

    const created = await request(origin, owner, "/api/plugins", {
      method: "POST",
      form: { name, plugin_type: "compressor" },
    });
    expect(created.status).toBe(303);
    const listed = await request(origin, owner, "/plugins");
    expect(listed.body).toContain(`value="${name}"`);
    const id = idAfter(listed.body, "/api/plugins/", name);

    const renamed = `${name} v2`;
    await request(origin, owner, `/api/plugins/${id}`, {
      method: "POST",
      form: { action: "update", name: renamed, plugin_type: "eq" },
    });
    const favorite = await request(origin, owner, `/api/plugins/${id}`, {
      method: "POST",
      form: { action: "favorite", is_favorite: "true" },
    });
    expect(favorite.status).toBe(303);
    const updated = await request(origin, owner, "/plugins");
    expect(updated.body).toContain(`value="${renamed}"`);
    expect(updated.body).toContain("★ Favorite");

    const other = new Map<string, string>();
    await signIn(origin, other, `plugin-b-${stamp}@example.com`, password);
    expect((await request(origin, other, "/plugins")).body).not.toContain(renamed);
    const foreignDelete = await request(origin, other, `/api/plugins/${id}`, {
      method: "POST",
      form: { action: "delete" },
    });
    expect(foreignDelete.status).toBe(404);
    expect((await request(origin, owner, "/plugins")).body).toContain(`value="${renamed}"`);

    const deleted = await request(origin, owner, `/api/plugins/${id}`, { method: "POST", form: { action: "delete" } });
    expect(deleted.status).toBe(303);
    const afterDelete = await request(origin, owner, "/plugins");
    expect(afterDelete.body).not.toContain(renamed);

    const missing = await request(origin, owner, `/api/plugins/${missingUuid}`, {
      method: "POST",
      form: { action: "delete" },
    });
    expect(missing.status).toBe(404);
  }, 60_000);

  it("creates and edits a track for its owner only", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Track-Http-Passw0rd!";
    const name = `Track ${stamp}`;

    const anonymous = new Map<string, string>();
    const anonymousPage = await request(origin, anonymous, "/tracks");
    expect(anonymousPage.status).toBe(302);
    expect(anonymousPage.locationPath).toBe("/auth/signin");
    const anonymousForm = { method: "POST", form: { name, stage: "aranz" } };
    expect((await request(origin, anonymous, "/api/tracks", anonymousForm)).status).toBe(401);
    expect((await request(origin, anonymous, `/api/tracks/${missingUuid}`, anonymousForm)).status).toBe(401);

    const owner = new Map<string, string>();
    await signIn(origin, owner, `track-a-${stamp}@example.com`, password);

    const rejected = await request(origin, owner, "/api/tracks", {
      method: "POST",
      form: { name: "Typed track", stage: "mastering" },
    });
    expect(rejected.status).toBe(303);
    expect((await request(origin, owner, rejected.location)).body).toContain('value="Typed track"');

    const nonFormCreate = await request(origin, owner, "/api/tracks", { method: "POST", json: { name } });
    expect(nonFormCreate.status).toBe(303);
    expect(nonFormCreate.locationPath).toBe("/tracks");

    const splitEmoji = await request(origin, owner, "/api/tracks", {
      method: "POST",
      form: { name: `${"a".repeat(99)}😀`, stage: "aranz" },
    });
    expect(splitEmoji.status).toBe(303);

    const created = await request(origin, owner, "/api/tracks", { method: "POST", form: { name, stage: "aranz" } });
    expect(created.status).toBe(303);
    const trackPath = created.location;
    expect(trackPath).toMatch(/^\/tracks\/[0-9a-f-]{36}$/);
    expect((await request(origin, owner, "/tracks")).body).toContain(name);
    expect((await request(origin, owner, trackPath)).body).toMatch(/<option[^>]*value="aranz"[^>]*selected/);

    const nonFormEdit = await request(origin, owner, `/api${trackPath}`, { method: "POST", json: { name } });
    expect(nonFormEdit.status).toBe(303);
    expect(nonFormEdit.locationPath).toBe(trackPath);

    const edited = await request(origin, owner, `/api${trackPath}`, {
      method: "POST",
      form: { name: `${name} v2`, stage: "miks" },
    });
    expect(edited.status).toBe(303);
    const afterEdit = await request(origin, owner, trackPath);
    expect(afterEdit.body).toContain(`value="${name} v2"`);
    expect(afterEdit.body).toMatch(/<option[^>]*value="miks"[^>]*selected/);

    const other = new Map<string, string>();
    await signIn(origin, other, `track-b-${stamp}@example.com`, password);
    expect((await request(origin, other, trackPath)).status).toBe(404);
    const foreignEdit = await request(origin, other, `/api${trackPath}`, {
      method: "POST",
      form: { name: "stolen", stage: "master" },
    });
    expect(foreignEdit.status).toBe(404);
    expect((await request(origin, owner, trackPath)).body).toContain(`value="${name} v2"`);
  }, 60_000);
});
