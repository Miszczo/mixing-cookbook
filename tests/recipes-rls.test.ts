/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { requireAnonEnv } from "./helpers/supabase-env";

const { url, key } = requireAnonEnv();
const STARTER = "sidechain-kick-bass";

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

function recipeRow(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    intent: "Tighten the bass",
    required_type: "compressor",
    steps: [{ id: "one", text: "Route the kick" }],
    image_data: "png-bytes",
    image_mime: "image/png",
    ...overrides,
  };
}

describe("recipes row rules", () => {
  let owner: Actor;
  let other: Actor;
  let recipeId: string;
  let trackId: string;

  async function ownerRecipe() {
    const { data, error } = await owner.client
      .from("recipes")
      .select("id, intent, required_type, steps, image_mime")
      .eq("id", recipeId)
      .single();
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Recipe-Rls-Passw0rd!";
    owner = await signedIn(`recipes-a-${stamp}@example.com`, password);
    other = await signedIn(`recipes-b-${stamp}@example.com`, password);

    const inserted = await owner.client.from("recipes").insert(recipeRow(owner.userId)).select("id").single();
    if (inserted.error) throw inserted.error;
    recipeId = inserted.data.id as string;

    const track = await owner.client
      .from("tracks")
      .insert({ user_id: owner.userId, name: "Owner track", stage: "miks" })
      .select("id")
      .single();
    if (track.error) throw track.error;
    trackId = track.data.id as string;
  }, 30_000);

  it("lets the owner read the recipe and hides it from another user", async () => {
    const seen = await ownerRecipe();
    expect(seen.intent).toBe("Tighten the bass");
    expect(seen.required_type).toBe("compressor");

    const hidden = await other.client.from("recipes").select("id").eq("id", recipeId);
    if (hidden.error) throw hidden.error;
    expect(hidden.data).toEqual([]);
  }, 30_000);

  it("refuses an insert that spoofs the owner's user id", async () => {
    const spoofed = await other.client.from("recipes").insert(recipeRow(owner.userId));
    expect(spoofed.error).not.toBeNull();
  }, 30_000);

  it("refuses another user's delete and keeps the row", async () => {
    const removed = await other.client.from("recipes").delete().eq("id", recipeId).select("id");
    if (removed.error === null) {
      expect(removed.data).toEqual([]);
    }

    expect((await ownerRecipe()).id).toBe(recipeId);
  }, 30_000);

  it("refuses an update because there is no grant", async () => {
    const before = await ownerRecipe();

    const update = await owner.client.from("recipes").update({ intent: "Changed intent" }).eq("id", recipeId);
    expect(update.error).not.toBeNull();

    expect(await ownerRecipe()).toEqual(before);
  }, 30_000);

  it("rejects empty steps, too many steps, a bad mime type, and an oversized image", async () => {
    const empty = await owner.client.from("recipes").insert(recipeRow(owner.userId, { steps: [] }));
    expect(empty.error).not.toBeNull();

    const tooMany = await owner.client.from("recipes").insert(
      recipeRow(owner.userId, {
        steps: Array.from({ length: 21 }, (_, index) => ({ id: `s${index}`, text: "Step" })),
      }),
    );
    expect(tooMany.error).not.toBeNull();

    const mime = await owner.client.from("recipes").insert(recipeRow(owner.userId, { image_mime: "image/gif" }));
    expect(mime.error).not.toBeNull();

    const huge = await owner.client
      .from("recipes")
      .insert(recipeRow(owner.userId, { image_data: "x".repeat(1_400_001) }));
    expect(huge.error).not.toBeNull();
  }, 30_000);

  it("removes progress for the deleted recipe and leaves the starter recipe", async () => {
    const saved = await owner.client.from("track_recipe_progress").insert([
      { track_id: trackId, recipe_id: recipeId, user_id: owner.userId, completed_steps: ["one"] },
      { track_id: trackId, recipe_id: STARTER, user_id: owner.userId, completed_steps: ["route-kick"] },
    ]);
    if (saved.error) throw saved.error;

    const removed = await owner.client.from("recipes").delete().eq("id", recipeId);
    if (removed.error) throw removed.error;

    const progress = await owner.client.from("track_recipe_progress").select("recipe_id").eq("track_id", trackId);
    if (progress.error) throw progress.error;
    expect(progress.data).toEqual([{ recipe_id: STARTER }]);
  }, 30_000);
});
