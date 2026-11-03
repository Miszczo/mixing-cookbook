/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { requireAnonEnv } from "./helpers/supabase-env";

const { url, key } = requireAnonEnv();
const RECIPE = "sidechain-kick-bass";

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

async function ownedRow(table: "tracks" | "plugins", actor: Actor, values: Record<string, unknown>): Promise<string> {
  const { data, error } = await actor.client
    .from(table)
    .insert({ user_id: actor.userId, ...values })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("track_recipe_progress row rules", () => {
  let owner: Actor;
  let other: Actor;
  let trackId: string;
  let pluginId: string;
  let otherTrackId: string;
  let otherPluginId: string;

  async function ownerRow() {
    const { data, error } = await owner.client
      .from("track_recipe_progress")
      .select("completed_steps, selected_plugin_id, use_native")
      .eq("track_id", trackId)
      .single();
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Recipe-Rls-Passw0rd!";
    owner = await signedIn(`recipe-a-${stamp}@example.com`, password);
    other = await signedIn(`recipe-b-${stamp}@example.com`, password);
    trackId = await ownedRow("tracks", owner, { name: "Owner track", stage: "miks" });
    pluginId = await ownedRow("plugins", owner, { name: "Owner comp", plugin_type: "compressor" });
    otherTrackId = await ownedRow("tracks", other, { name: "Other track", stage: "miks" });
    otherPluginId = await ownedRow("plugins", other, { name: "Other comp", plugin_type: "compressor" });

    const saved = await owner.client
      .from("track_recipe_progress")
      .upsert(
        { track_id: trackId, recipe_id: RECIPE, user_id: owner.userId, completed_steps: ["route-kick"] },
        { onConflict: "track_id,recipe_id" },
      );
    if (saved.error) throw saved.error;
  }, 30_000);

  it("keeps other columns when a write names only one", async () => {
    const chosen = await owner.client.from("track_recipe_progress").upsert(
      {
        track_id: trackId,
        recipe_id: RECIPE,
        user_id: owner.userId,
        selected_plugin_id: pluginId,
        use_native: false,
      },
      { onConflict: "track_id,recipe_id" },
    );
    if (chosen.error) throw chosen.error;

    expect(await ownerRow()).toEqual({
      completed_steps: ["route-kick"],
      selected_plugin_id: pluginId,
      use_native: false,
    });
  }, 30_000);

  it("hides the row from another user and from anonymous reads", async () => {
    const seen = await other.client.from("track_recipe_progress").select("track_id").eq("track_id", trackId);
    if (seen.error) throw seen.error;
    expect(seen.data).toEqual([]);

    const anonymous = await anonClient().from("track_recipe_progress").select("track_id");
    expect(anonymous.error).not.toBeNull();
  }, 30_000);

  it("refuses anonymous inserts and updates", async () => {
    const before = await ownerRow();
    const anon = anonClient();

    const insert = await anon
      .from("track_recipe_progress")
      .insert({ track_id: trackId, recipe_id: "anon-recipe", user_id: owner.userId });
    expect(insert.error).not.toBeNull();

    const update = await anon
      .from("track_recipe_progress")
      .update({ completed_steps: ["anon"] })
      .eq("track_id", trackId);
    expect(update.error).not.toBeNull();

    expect(await ownerRow()).toEqual(before);
  }, 30_000);

  it("refuses an insert that spoofs another user's id", async () => {
    const asOther = await other.client
      .from("track_recipe_progress")
      .insert({ track_id: otherTrackId, recipe_id: RECIPE, user_id: owner.userId });
    expect(asOther.error).not.toBeNull();

    const asOwner = await owner.client
      .from("track_recipe_progress")
      .insert({ track_id: otherTrackId, recipe_id: RECIPE, user_id: owner.userId });
    expect(asOwner.error).not.toBeNull();
  }, 30_000);

  it("refuses moving a row to another track and refuses deletes", async () => {
    const before = await ownerRow();

    const move = await owner.client
      .from("track_recipe_progress")
      .update({ track_id: otherTrackId })
      .eq("track_id", trackId);
    expect(move.error).not.toBeNull();

    const removed = await owner.client.from("track_recipe_progress").delete().eq("track_id", trackId);
    expect(removed.error).not.toBeNull();

    expect(await ownerRow()).toEqual(before);
  }, 30_000);

  it("refuses another user's update and insert on the owner's track", async () => {
    const before = await ownerRow();

    const update = await other.client
      .from("track_recipe_progress")
      .update({ completed_steps: ["stolen"] })
      .eq("track_id", trackId)
      .select("track_id");
    if (update.error) throw update.error;
    expect(update.data).toEqual([]);

    const insert = await other.client
      .from("track_recipe_progress")
      .insert({ track_id: trackId, recipe_id: "another-recipe", user_id: other.userId });
    expect(insert.error).not.toBeNull();

    expect(await ownerRow()).toEqual(before);
  }, 30_000);

  it("refuses storing another user's plugin id", async () => {
    const before = await ownerRow();

    const update = await owner.client
      .from("track_recipe_progress")
      .update({ selected_plugin_id: otherPluginId })
      .eq("track_id", trackId);
    expect(update.error).not.toBeNull();

    const ownTrack = await other.client
      .from("track_recipe_progress")
      .insert({ track_id: otherTrackId, recipe_id: RECIPE, user_id: other.userId, selected_plugin_id: pluginId });
    expect(ownTrack.error).not.toBeNull();

    expect(await ownerRow()).toEqual(before);
  }, 30_000);
});
