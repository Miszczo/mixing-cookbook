/// <reference types="vitest/globals" />
import type { ChildProcess } from "node:child_process";
import { request, reservePort, signIn, startApp, stopApp, waitForHttp, watchForLocalUrl } from "./helpers/http-app";

const PASSWORD = "Notes-Http-Passw0rd!";

type Jar = Map<string, string>;

/** The HTML of the notes section only, so text elsewhere on the page cannot satisfy an assertion. */
function notesSection(body: string): string {
  const start = body.indexOf('id="notes"');
  if (start === -1) throw new Error("no notes section on the page");
  const end = body.indexOf("</section>", start);
  return body.slice(start, end === -1 ? undefined : end);
}

function noteItems(body: string): string[] {
  return notesSection(body).split("<li").slice(1);
}

function datalistOptions(body: string): string[] {
  const list = /<datalist id="note-equipment-options">([\s\S]*?)<\/datalist>/.exec(body)?.[1] ?? "";
  return [...list.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
}

function deletePathFor(body: string, text: string): string {
  const item = noteItems(body).find((candidate) => candidate.includes(text));
  const path = item ? /action="(\/api\/tracks\/[0-9a-f-]{36}\/notes\/[0-9a-f-]{36})"/.exec(item)?.[1] : undefined;
  if (!path) throw new Error(`no delete form for ${text}`);
  return path;
}

describe("listening notes on the track page", () => {
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
    await signIn(origin, jar, `notes-http-${tag}-${Date.now()}-${crypto.randomUUID()}@example.com`, PASSWORD);
    return jar;
  }

  async function newTrack(jar: Jar, stage: string): Promise<string> {
    const created = await request(origin, jar, "/api/tracks", { method: "POST", form: { name: "Notes track", stage } });
    expect(created.status).toBe(303);
    return created.location;
  }

  function addNote(jar: Jar, trackPath: string, equipment: string, body: string) {
    return request(origin, jar, trackPath, { method: "POST", form: { action: "add-note", equipment, body } });
  }

  it("saves notes, lists them newest first, and keeps the stage each note was saved with", async () => {
    const jar = await user("owner");
    const trackPath = await newTrack(jar, "miks");

    const first = await addNote(jar, trackPath, "DT 770", "Sub za głośny");
    expect(first.status).toBe(303);
    expect(first.location).toBe(`${trackPath}#notes`);

    const afterFirst = await request(origin, jar, trackPath);
    expect(afterFirst.status).toBe(200);
    const [firstItem] = noteItems(afterFirst.body);
    expect(firstItem).toContain("Sub za głośny");
    expect(firstItem).toContain("DT 770");
    expect(firstItem).toContain("Miks");
    expect(firstItem).toMatch(/<time datetime="[^"]+"[^>]*>\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}<\/time>/);

    const second = await addNote(jar, trackPath, "Samochód", "Wokal OK");
    expect(second.status).toBe(303);
    const afterSecond = await request(origin, jar, trackPath);
    const section = notesSection(afterSecond.body);
    expect(noteItems(afterSecond.body)).toHaveLength(2);
    expect(section.indexOf("Wokal OK")).toBeGreaterThan(-1);
    expect(section.indexOf("Wokal OK")).toBeLessThan(section.indexOf("Sub za głośny"));

    const switched = await request(origin, jar, trackPath.replace("/tracks/", "/api/tracks/"), {
      method: "POST",
      form: { name: "Notes track", stage: "master" },
    });
    expect(switched.status).toBe(303);

    const onMaster = await request(origin, jar, trackPath);
    expect(onMaster.status).toBe(200);
    expect(onMaster.body).toContain('name="action" value="add-note"');
    const olderItem = noteItems(onMaster.body).find((item) => item.includes("Sub za głośny"));
    const newerItem = noteItems(onMaster.body).find((item) => item.includes("Wokal OK"));
    expect(olderItem).toContain("Miks");
    expect(newerItem).toContain("Miks");

    const third = await addNote(jar, trackPath, "dt 770 ", "Bas lepszy");
    expect(third.status).toBe(303);
    const afterThird = await request(origin, jar, trackPath);
    const [thirdItem] = noteItems(afterThird.body);
    expect(thirdItem).toContain("Bas lepszy");
    expect(thirdItem).toContain("Master");
    expect(datalistOptions(afterThird.body)).toEqual(["dt 770", "Samochód"]);
  }, 90_000);

  it("renders the insert-template button as a non-submitting control", async () => {
    const jar = await user("template");
    const trackPath = await newTrack(jar, "miks");

    const page = await request(origin, jar, trackPath);
    expect(page.status).toBe(200);
    const section = notesSection(page.body);
    expect(section).toMatch(/<button[^>]*id="note-template-button"[^>]*>/);
    expect(/<button[^>]*id="note-template-button"[^>]*>/.exec(section)?.[0]).toContain('type="button"');
    expect(section).toContain('id="note-template-message"');
  }, 60_000);

  it("keeps the typed text and saves nothing when the input is rejected", async () => {
    const jar = await user("invalid");
    const trackPath = await newTrack(jar, "aranz");

    const empty = await addNote(jar, trackPath, "Monitory", "   ");
    expect(empty.status).toBe(400);
    expect(empty.body).toContain("Enter the equipment (up to 100 characters) and your notes (up to 2000 characters).");
    expect(empty.body).toContain('value="Monitory"');

    const tooLong = "x".repeat(2001);
    const long = await addNote(jar, trackPath, "Monitory", tooLong);
    expect(long.status).toBe(400);
    expect(long.body).toContain(tooLong);
    expect(long.body).toContain('value="Monitory"');

    const unknown = await request(origin, jar, trackPath, {
      method: "POST",
      form: { action: "rename", equipment: "Monitory", body: "Tekst" },
    });
    expect(unknown.status).toBe(400);

    const after = await request(origin, jar, trackPath);
    expect(after.status).toBe(200);
    expect(noteItems(after.body)).toHaveLength(0);
    expect(after.body).toContain("No listening notes yet.");
  }, 90_000);

  it("hides notes from another user and refuses their writes", async () => {
    const owner = await user("owner2");
    const trackPath = await newTrack(owner, "miks");
    expect((await addNote(owner, trackPath, "DT 770", "Prywatna notatka")).status).toBe(303);
    const ownerView = await request(origin, owner, trackPath);
    const deletePath = deletePathFor(ownerView.body, "Prywatna notatka");

    const other = await user("other");
    const read = await request(origin, other, trackPath);
    expect(read.status).toBe(404);
    expect(read.body).not.toContain("Prywatna notatka");

    const write = await addNote(other, trackPath, "Intruz", "Cudza notatka");
    expect(write.status).toBe(404);

    const foreignDelete = await request(origin, other, deletePath, { method: "POST", form: { action: "delete" } });
    expect(foreignDelete.status).toBe(404);

    const after = await request(origin, owner, trackPath);
    expect(noteItems(after.body)).toHaveLength(1);
    expect(after.body).toContain("Prywatna notatka");
    expect(after.body).not.toContain("Cudza notatka");
  }, 90_000);

  it("deletes a note for its owner", async () => {
    const jar = await user("deleter");
    const trackPath = await newTrack(jar, "miks");
    expect((await addNote(jar, trackPath, "DT 770", "Zostaje")).status).toBe(303);
    expect((await addNote(jar, trackPath, "Samochód", "Do usunięcia")).status).toBe(303);
    const before = await request(origin, jar, trackPath);
    const deletePath = deletePathFor(before.body, "Do usunięcia");

    const refused = await request(origin, jar, deletePath, { method: "POST", form: { action: "keep" } });
    expect(refused.status).toBe(400);

    const deleted = await request(origin, jar, deletePath, { method: "POST", form: { action: "delete" } });
    expect(deleted.status).toBe(303);
    expect(deleted.location).toBe(`${trackPath}#notes`);

    const after = await request(origin, jar, trackPath);
    expect(after.body).not.toContain("Do usunięcia");
    expect(after.body).toContain("Zostaje");

    const again = await request(origin, jar, deletePath, { method: "POST", form: { action: "delete" } });
    expect(again.status).toBe(404);
  }, 90_000);
});
