/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { requireAnonEnv } from "./helpers/supabase-env";

const { url, key } = requireAnonEnv();

function anonClient() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedIn(email: string, password: string) {
  const client = anonClient();
  const signUp = await client.auth.signUp({ email, password });
  if (signUp.error) throw signUp.error;
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: signIn.data.user.id };
}

type Actor = Awaited<ReturnType<typeof signedIn>>;

async function ownedTrack(actor: Actor, name: string): Promise<string> {
  const { data, error } = await actor.client
    .from("tracks")
    .insert({ user_id: actor.userId, name, stage: "miks" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("listening_notes row rules", () => {
  let owner: Actor;
  let other: Actor;
  let trackId: string;
  let otherTrackId: string;

  function note(actor: Actor, track: string, overrides: Record<string, unknown> = {}) {
    return actor.client
      .from("listening_notes")
      .insert({
        track_id: track,
        user_id: actor.userId,
        equipment: "DT 770",
        body: "Sub za głośny",
        stage: "miks",
        ...overrides,
      })
      .select("id")
      .single();
  }

  async function ownerNotes() {
    const { data, error } = await owner.client
      .from("listening_notes")
      .select("id, equipment, body, stage")
      .eq("track_id", trackId);
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Notes-Rls-Passw0rd!";
    owner = await signedIn(`notes-a-${stamp}@example.com`, password);
    other = await signedIn(`notes-b-${stamp}@example.com`, password);
    trackId = await ownedTrack(owner, "Owner track");
    otherTrackId = await ownedTrack(other, "Other track");
  }, 30_000);

  it("lets the owner insert a note and read it back", async () => {
    const saved = await note(owner, trackId, { equipment: "Samochód", body: "Wokal OK" });
    if (saved.error) throw saved.error;

    const rows = await ownerNotes();
    const id = saved.data.id as string;
    expect(rows).toContainEqual({ id, equipment: "Samochód", body: "Wokal OK", stage: "miks" });
  }, 30_000);

  it("hides notes from another user and from anonymous reads", async () => {
    const seen = await other.client.from("listening_notes").select("id");
    if (seen.error) throw seen.error;
    expect(seen.data).toEqual([]);

    const anonymous = await anonClient().from("listening_notes").select("id");
    expect(anonymous.error).not.toBeNull();
  }, 30_000);

  it("refuses inserts onto another user's track, with either user id", async () => {
    const asOther = await note(other, trackId);
    expect(asOther.error).not.toBeNull();

    const spoofed = await note(other, trackId, { user_id: owner.userId });
    expect(spoofed.error).not.toBeNull();

    const ownerOnOther = await note(owner, otherTrackId);
    expect(ownerOnOther.error).not.toBeNull();

    expect(await ownerNotes()).not.toContainEqual(expect.objectContaining({ body: "Sub za głośny" }));
  }, 30_000);

  it("refuses anonymous inserts", async () => {
    const anon = await anonClient()
      .from("listening_notes")
      .insert({ track_id: trackId, user_id: owner.userId, equipment: "x", body: "y", stage: "miks" });
    expect(anon.error).not.toBeNull();
  }, 30_000);

  it("refuses updates, even by the owner", async () => {
    const before = await ownerNotes();

    const update = await owner.client.from("listening_notes").update({ body: "Zmienione" }).eq("track_id", trackId);
    expect(update.error).not.toBeNull();

    expect(await ownerNotes()).toEqual(before);
  }, 30_000);

  it("rejects values that break the check constraints", async () => {
    const bad: Record<string, unknown>[] = [
      { equipment: "" },
      { equipment: "a".repeat(101) },
      { body: "" },
      { body: "a".repeat(2001) },
      { stage: "mix" },
    ];
    for (const overrides of bad) {
      const result = await note(owner, trackId, overrides);
      expect(result.error, JSON.stringify(Object.keys(overrides))).not.toBeNull();
    }
  }, 30_000);

  it("lets only the owner delete a note", async () => {
    const saved = await note(owner, trackId, { equipment: "Monitory", body: "Do usunięcia" });
    if (saved.error) throw saved.error;
    const id = saved.data.id as string;

    const byOther = await other.client.from("listening_notes").delete().eq("id", id).select("id");
    if (byOther.error) throw byOther.error;
    expect(byOther.data).toEqual([]);
    expect(await ownerNotes()).toContainEqual(expect.objectContaining({ id }));

    const byOwner = await owner.client.from("listening_notes").delete().eq("id", id).select("id");
    if (byOwner.error) throw byOwner.error;
    expect(byOwner.data).toEqual([{ id }]);
    expect(await ownerNotes()).not.toContainEqual(expect.objectContaining({ id }));
  }, 30_000);
});
