/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { seedDemo } from "../scripts/seed-demo.mjs";
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

const TABLES = ["daw_profiles", "plugins", "tracks", "track_recipe_progress", "recipes", "listening_notes"] as const;

const EXPECTED_COUNTS = {
  daw_profiles: 1,
  plugins: 6,
  tracks: 3,
  track_recipe_progress: 2,
  recipes: 2,
  listening_notes: 5,
};

async function snapshot(actor: Actor) {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const { count, error } = await actor.client.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  const tracks = await actor.client.from("tracks").select("name").order("name");
  if (tracks.error) throw tracks.error;
  return { counts, trackNames: tracks.data.map((row) => row.name as string) };
}

describe("seed-demo", () => {
  let demo: Actor;
  let stranger: Actor;

  beforeAll(async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Seed-Demo-Passw0rd!";
    demo = await signedIn(`seed-demo-a-${stamp}@example.com`, password);
    stranger = await signedIn(`seed-demo-b-${stamp}@example.com`, password);
  }, 30_000);

  it("gives the same rows after a second run and hides them from another user", async () => {
    const returned = await seedDemo(demo.client, demo.userId);
    expect(returned).toEqual(EXPECTED_COUNTS);
    const first = await snapshot(demo);

    const secondReturned = await seedDemo(demo.client, demo.userId);
    expect(secondReturned).toEqual(EXPECTED_COUNTS);
    const second = await snapshot(demo);

    expect(first.counts).toEqual(EXPECTED_COUNTS);
    expect(second.counts).toEqual(first.counts);
    expect(first.trackNames).toEqual(["Kolory", "Nocna jazda", "Szkic: Lato"]);
    expect(second.trackNames).toEqual(first.trackNames);

    const other = await snapshot(stranger);
    expect(Object.values(other.counts).every((count) => count === 0)).toBe(true);
  }, 60_000);

  it("seeds the DAW, progress, own recipes and the equipment split", async () => {
    await seedDemo(demo.client, demo.userId);

    const daw = await demo.client.from("daw_profiles").select("daw_id").single();
    if (daw.error) throw daw.error;
    expect(daw.data.daw_id).toBe("ableton-live");

    const plugins = await demo.client.from("plugins").select("id, name");
    if (plugins.error) throw plugins.error;
    const proC = plugins.data.find((plugin) => plugin.name === "FabFilter Pro-C 2");

    const progress = await demo.client
      .from("track_recipe_progress")
      .select("recipe_id, completed_steps, selected_plugin_id, use_native");
    if (progress.error) throw progress.error;
    const sidechain = progress.data.find((row) => row.recipe_id === "sidechain-kick-bass");
    const glue = progress.data.find((row) => row.recipe_id === "drum-bus-glue");
    expect(sidechain?.completed_steps).toHaveLength(3);
    expect(sidechain?.selected_plugin_id).toBe(proC?.id);
    expect(glue?.use_native).toBe(true);

    const recipes = await demo.client.from("recipes").select("intent, steps, image_mime, image_data");
    if (recipes.error) throw recipes.error;
    const stepCounts = Object.fromEntries(
      recipes.data.map((row) => [row.intent as string, (row.steps as unknown[]).length]),
    );
    expect(stepCounts).toEqual({ "Równoległa kompresja wokalu": 4, "Szerokie stereo na padzie": 3 });
    expect(recipes.data.every((row) => row.image_mime === "image/png")).toBe(true);
    // PNG signature in base64.
    expect(recipes.data.every((row) => (row.image_data as string).startsWith("iVBORw0KGgo"))).toBe(true);

    const notes = await demo.client.from("listening_notes").select("equipment, stage");
    if (notes.error) throw notes.error;
    const split: Record<string, number> = {};
    for (const note of notes.data) {
      split[note.equipment as string] = (split[note.equipment as string] ?? 0) + 1;
    }
    expect(split).toEqual({ "Słuchawki DT 770": 2, Monitory: 2, Samochód: 1 });
    expect(new Set(notes.data.map((note) => note.stage as string))).toEqual(new Set(["miks", "master"]));
  }, 60_000);
});
