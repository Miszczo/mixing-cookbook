/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const route = "/api/profile/primary-daw";

describe("primary DAW on the dashboard", () => {
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

  it("saves, replaces, and rejects a choice for one user only", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Daw-Http-Passw0rd!";

    const anonymous = new Map<string, string>();
    const anonymousPage = await request(origin, anonymous, "/dashboard");
    expect(anonymousPage.status).toBe(302);
    expect(anonymousPage.locationPath).toBe("/auth/signin");
    expect(anonymousPage.body).not.toContain("This page is only for authenticated users.");

    const anonymousPost = await request(origin, anonymous, route, { method: "POST", form: { daw_id: "reaper" } });
    expect(anonymousPost.status).toBe(401);
    expect(anonymousPost.body).not.toContain("reaper");

    const owner = new Map<string, string>();
    await signIn(origin, owner, `daw-http-a-${stamp}@example.com`, password);

    const unset = await request(origin, owner, "/dashboard");
    expect(unset.status).toBe(200);
    expect(unset.body).toContain("No primary DAW is set.");

    const empty = await request(origin, owner, route, { method: "POST", form: { daw_id: "" } });
    expect(empty.status).toBe(303);
    expect(empty.location).toBe("/dashboard?error=invalid_daw");
    const stillUnset = await request(origin, owner, empty.location);
    expect(stillUnset.body).toContain("No primary DAW is set.");
    expect(stillUnset.body).toContain("Choose a primary DAW.");

    const saved = await request(origin, owner, route, { method: "POST", form: { daw_id: "ableton-live" } });
    expect(saved.status).toBe(303);
    expect(saved.location).toBe("/dashboard");
    const afterSave = await request(origin, owner, "/dashboard");
    expect(afterSave.body).toContain("Primary DAW: Ableton Live");

    const replaced = await request(origin, owner, route, { method: "POST", form: { daw_id: "fl-studio" } });
    expect(replaced.status).toBe(303);
    const afterReplace = await request(origin, owner, "/dashboard");
    expect(afterReplace.body).toContain("Primary DAW: FL Studio");
    expect(afterReplace.body).not.toContain("Primary DAW: Ableton Live");

    const bad = await request(origin, owner, route, { method: "POST", form: { daw_id: "cubase" } });
    expect(bad.status).toBe(303);
    expect(bad.location).toBe("/dashboard?error=invalid_daw");
    const afterBad = await request(origin, owner, "/dashboard");
    expect(afterBad.body).toContain("Primary DAW: FL Studio");

    const other = new Map<string, string>();
    await signIn(origin, other, `daw-http-b-${stamp}@example.com`, password);
    const otherPage = await request(origin, other, "/dashboard");
    expect(otherPage.status).toBe(200);
    expect(otherPage.body).toContain("No primary DAW is set.");
    expect(otherPage.body).not.toContain("Primary DAW: FL Studio");
  }, 60_000);
});
