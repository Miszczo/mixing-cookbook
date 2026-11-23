/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const PASSWORD = "Notes-Overview-Passw0rd!";

type Jar = Map<string, string>;

/** The HTML of the overview section only, so text elsewhere on the page cannot satisfy an assertion. */
function overviewSection(body: string): string {
  const start = body.indexOf('id="notes-overview"');
  if (start === -1) throw new Error("no notes overview section on the page");
  const end = body.indexOf("</section>", start);
  return body.slice(start, end === -1 ? undefined : end);
}

function overviewItems(body: string): string[] {
  return overviewSection(body).split("<li").slice(1);
}

function selectOptions(body: string): { value: string; selected: boolean }[] {
  const select = /<select[^>]*id="notes-equipment"[^>]*>([\s\S]*?)<\/select>/.exec(body)?.[1] ?? "";
  return [...select.matchAll(/<option([^>]*)>/g)].map((match) => ({
    value: /value="([^"]*)"/.exec(match[1])?.[1] ?? "",
    selected: /\sselected(?=[\s=>]|$)/.test(match[1]),
  }));
}

function optionValues(body: string): string[] {
  return selectOptions(body).map((option) => option.value);
}

describe("listening notes overview page", () => {
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
    await signIn(origin, jar, `notes-overview-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`, PASSWORD);
    return jar;
  }

  async function newTrack(jar: Jar, name: string): Promise<string> {
    const created = await request(origin, jar, "/api/tracks", { method: "POST", form: { name, stage: "miks" } });
    expect(created.status).toBe(303);
    return created.location;
  }

  async function addNote(jar: Jar, trackPath: string, equipment: string, body: string): Promise<void> {
    const saved = await request(origin, jar, trackPath, {
      method: "POST",
      form: { action: "add-note", equipment, body },
    });
    expect(saved.status).toBe(303);
  }

  it("lists notes across tracks, filters by equipment and keeps the unknown value selected", async () => {
    const jar = await user("owner");
    const trackA = await newTrack(jar, "Track Alpha");
    const trackB = await newTrack(jar, "Track Beta");
    await addNote(jar, trackA, "DT 770", "Nota jeden");
    await addNote(jar, trackB, "dt 770", "Nota dwa");
    await addNote(jar, trackA, "DT 770 Pro", "Nota trzy");
    await addNote(jar, trackB, "Samochód", "Nota cztery");

    const all = await request(origin, jar, "/notes");
    expect(all.status).toBe(200);
    const items = overviewItems(all.body);
    expect(items).toHaveLength(4);
    expect(items[0]).toContain("Nota cztery");
    expect(items[1]).toContain("Nota trzy");
    expect(items[2]).toContain("Nota dwa");
    expect(items[3]).toContain("Nota jeden");
    expect(items[0]).toContain("Track Beta");
    expect(items[0]).toContain(`href="${trackB}#notes"`);
    expect(items[1]).toContain("Track Alpha");
    expect(items[1]).toContain(`href="${trackA}#notes"`);
    expect(items[2]).toContain(`href="${trackB}#notes"`);
    expect(items[3]).toContain(`href="${trackA}#notes"`);
    expect(optionValues(all.body)).toEqual(["", "dt 770", "DT 770 Pro", "Samochód"]);
    expect(selectOptions(all.body)[0].selected).toBe(true);
    expect(all.body).toContain("All");

    const dt = await request(origin, jar, "/notes?equipment=DT%20770");
    expect(dt.status).toBe(200);
    const dtItems = overviewItems(dt.body);
    expect(dtItems).toHaveLength(2);
    expect(dtItems.some((item) => item.includes("Nota jeden"))).toBe(true);
    expect(dtItems.some((item) => item.includes("Nota dwa"))).toBe(true);
    expect(overviewSection(dt.body)).not.toContain("Nota trzy");
    expect(selectOptions(dt.body).filter((option) => option.selected)).toEqual([{ value: "dt 770", selected: true }]);

    const car = await request(origin, jar, "/notes?equipment=SAMOCH%C3%93D");
    expect(car.status).toBe(200);
    const carItems = overviewItems(car.body);
    expect(carItems).toHaveLength(1);
    expect(carItems[0]).toContain("Nota cztery");

    const unknown = await request(origin, jar, "/notes?equipment=Nieznany");
    expect(unknown.status).toBe(200);
    expect(unknown.body).toContain("No notes for this equipment.");
    expect(overviewItems(unknown.body)).toHaveLength(0);
    expect(selectOptions(unknown.body).filter((option) => option.selected)).toEqual([
      { value: "Nieznany", selected: true },
    ]);
  }, 120_000);

  it("treats percent signs in the filter literally", async () => {
    const jar = await user("wildcard");
    const track = await newTrack(jar, "Wildcard track");
    await addNote(jar, track, "50%", "Procent");
    await addNote(jar, track, "500", "Pięćset");

    const page = await request(origin, jar, "/notes?equipment=50%25");
    expect(page.status).toBe(200);
    const items = overviewItems(page.body);
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("Procent");
    expect(overviewSection(page.body)).not.toContain("Pięćset");
  }, 90_000);

  it("treats asterisks and regex characters in the filter literally", async () => {
    const jar = await user("asterisk");
    const track = await newTrack(jar, "Asterisk track");
    await addNote(jar, track, "Mic*", "Gwiazdka");
    await addNote(jar, track, "Mic Pre", "Przedwzmacniacz");
    await addNote(jar, track, "A.B (x)", "Nawiasy");
    await addNote(jar, track, "AxB x", "Kropka");

    const star = await request(origin, jar, "/notes?equipment=Mic*");
    expect(star.status).toBe(200);
    const starItems = overviewItems(star.body);
    expect(starItems).toHaveLength(1);
    expect(starItems[0]).toContain("Gwiazdka");

    const regex = await request(origin, jar, "/notes?equipment=A.B%20(x)");
    expect(regex.status).toBe(200);
    const regexItems = overviewItems(regex.body);
    expect(regexItems).toHaveLength(1);
    expect(regexItems[0]).toContain("Nawiasy");
  }, 90_000);

  it("treats underscores and backslashes in the filter literally", async () => {
    const jar = await user("underscore");
    const track = await newTrack(jar, "Underscore track");
    await addNote(jar, track, "A_B", "Podkreślnik");
    await addNote(jar, track, "AxB", "Dowolny znak");
    await addNote(jar, track, "C\\D", "Ukośnik");
    await addNote(jar, track, "CD", "Bez ukośnika");

    const underscore = await request(origin, jar, "/notes?equipment=A_B");
    expect(underscore.status).toBe(200);
    const underscoreItems = overviewItems(underscore.body);
    expect(underscoreItems).toHaveLength(1);
    expect(underscoreItems[0]).toContain("Podkreślnik");

    const backslash = await request(origin, jar, "/notes?equipment=C%5CD");
    expect(backslash.status).toBe(200);
    const backslashItems = overviewItems(backslash.body);
    expect(backslashItems).toHaveLength(1);
    expect(backslashItems[0]).toContain("Ukośnik");
  }, 90_000);

  it("shows another user nothing of the owner's notes", async () => {
    const owner = await user("owner2");
    const track = await newTrack(owner, "Prywatny track");
    await addNote(owner, track, "DT 770", "Prywatna notatka");

    const other = await user("other");
    for (const path of ["/notes", "/notes?equipment=DT%20770"]) {
      const page = await request(origin, other, path);
      expect(page.status).toBe(200);
      expect(overviewItems(page.body)).toHaveLength(0);
      expect(optionValues(page.body).filter((value) => value !== "" && value !== "DT 770")).toEqual([]);
      expect(page.body).not.toContain("Prywatna notatka");
      expect(page.body).not.toContain("Prywatny track");
    }

    const plain = await request(origin, other, "/notes");
    expect(plain.body).toContain("No listening notes yet.");
    expect(optionValues(plain.body)).toEqual([""]);
  }, 90_000);

  it("redirects to sign-in without a session", async () => {
    const response = await request(origin, new Map(), "/notes");
    expect(response.status).toBe(302);
    expect(response.locationPath).toBe("/auth/signin");
  }, 30_000);
});
