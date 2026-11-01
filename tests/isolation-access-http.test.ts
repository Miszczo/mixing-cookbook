/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const authenticatedSentence = "This page is only for authenticated users.";

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
