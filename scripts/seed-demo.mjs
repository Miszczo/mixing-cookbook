import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Demo seed: replaces the demo account's data with a fixed set, as an ordinary signed-in user under RLS.
// Run: npm run seed:demo   (needs SUPABASE_URL, SUPABASE_KEY, DEMO_EMAIL, DEMO_PASSWORD; .env is read when present)
// A non-local SUPABASE_URL is refused unless --yes is passed.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const IMAGE_PATH = fileURLToPath(new URL("../public/recipes/sidechain-settings-mock.png", import.meta.url));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const DAW_ID = "ableton-live";

const PLUGINS = [
  { name: "FabFilter Pro-C 2", plugin_type: "compressor", is_favorite: true },
  { name: "SSL Bus Compressor", plugin_type: "compressor", is_favorite: false },
  { name: "FabFilter Pro-Q 3", plugin_type: "eq", is_favorite: true },
  { name: "Valhalla Plate", plugin_type: "reverb", is_favorite: true },
  { name: "EchoBoy", plugin_type: "delay", is_favorite: false },
  { name: "Decapitator", plugin_type: "saturation", is_favorite: false },
];

const TRACKS = [
  { name: "Szkic: Lato", stage: "aranz" },
  { name: "Nocna jazda", stage: "miks" },
  { name: "Kolory", stage: "master" },
];

const OWN_RECIPES = [
  {
    intent: "Równoległa kompresja wokalu",
    required_type: "compressor",
    steps: [
      "Utwórz ścieżkę zwrotną (return) i wstaw na niej kompresor.",
      "Ustaw wysokie ratio, ok. 8:1, i szybki attack, żeby return mocno ściskał wokal.",
      "Wyślij wokal na return, aż kompresja będzie dodawać gęstość, ale nie zabierze dynamiki.",
      "Porównaj wokal z returnem i bez niego, wyrównując głośność.",
    ],
  },
  {
    intent: "Szerokie stereo na padzie",
    required_type: "other",
    steps: [
      "Wstaw na pad narzędzie do poszerzania stereo (stereo width / utility).",
      "Poszerzaj obraz, aż pad zacznie wypełniać boki miksu.",
      "Sprawdź miks w mono: pad nie powinien znikać ani zmieniać barwy.",
    ],
  },
];

// Starter recipe ids and step ids come from src/lib/recipes.ts.
const SIDECHAIN_STEPS_DONE = ["insert-compressor", "route-kick", "ratio-attack"];

const NOTES = [
  {
    track: "Nocna jazda",
    stage: "miks",
    equipment: "Słuchawki DT 770",
    body: "Bas jest pełny, ale sidechain ściska go za długo. Skrócić release.",
  },
  {
    track: "Nocna jazda",
    stage: "miks",
    equipment: "Monitory",
    body: "Na monitorach bas brzmi równiej, wokal siedzi dobrze w środku.",
  },
  {
    track: "Nocna jazda",
    stage: "miks",
    equipment: "Samochód",
    body: "W samochodzie dół dudni, trzeba przyciąć okolice 80 Hz.",
  },
  {
    track: "Kolory",
    stage: "master",
    equipment: "Słuchawki DT 770",
    body: "Wysokie tony są nieco ostre, sprawdzić delikatne cięcie powyżej 8 kHz.",
  },
  {
    track: "Kolory",
    stage: "master",
    equipment: "Monitory",
    body: "Szerokość stereo jest dobra, głośność zbliżona do utworów referencyjnych.",
  },
];

/** Throws an error that names the table when a Supabase call failed. */
function ok(table, error) {
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

/** Same encoding as encodeImage in src/lib/recipe-input.ts: base64 of the file bytes. */
async function readOwnRecipeImage() {
  const bytes = await readFile(IMAGE_PATH);
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error(`${IMAGE_PATH} is not a PNG file`);
  }
  return Buffer.from(bytes).toString("base64");
}

/**
 * Replaces the signed-in user's data with the demo set and returns the row counts per table.
 * `client` is a signed-in supabase-js client, `userId` its user id.
 *
 * Tracks have no delete policy, so they are not deleted: tracks with the demo names are reused (the stage is reset)
 * and missing ones are created. Deleting the recipes removes their progress through the table trigger, and deleting
 * the plugins clears the selected plugin on the remaining progress rows.
 */
export async function seedDemo(client, userId) {
  const imageData = await readOwnRecipeImage();

  // Notes first: they belong to tracks, which stay.
  const notesGone = await client.from("listening_notes").delete().eq("user_id", userId);
  ok("listening_notes", notesGone.error);
  const recipesGone = await client.from("recipes").delete().eq("user_id", userId);
  ok("recipes", recipesGone.error);
  const pluginsGone = await client.from("plugins").delete().eq("user_id", userId);
  ok("plugins", pluginsGone.error);

  const daw = await client
    .from("daw_profiles")
    .upsert({ user_id: userId, daw_id: DAW_ID, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  ok("daw_profiles", daw.error);

  const existingTracks = await client
    .from("tracks")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  ok("tracks", existingTracks.error);

  const trackIds = new Map();
  for (const track of TRACKS) {
    const found = existingTracks.data.find((row) => row.name === track.name);
    if (found) {
      const updated = await client
        .from("tracks")
        .update({ stage: track.stage, updated_at: new Date().toISOString() })
        .eq("id", found.id)
        .eq("user_id", userId);
      ok("tracks", updated.error);
      trackIds.set(track.name, found.id);
    } else {
      const created = await client
        .from("tracks")
        .insert({ user_id: userId, name: track.name, stage: track.stage })
        .select("id")
        .single();
      ok("tracks", created.error);
      trackIds.set(track.name, created.data.id);
    }
  }

  const plugins = await client
    .from("plugins")
    .insert(PLUGINS.map((plugin) => ({ user_id: userId, ...plugin })))
    .select("id, name");
  ok("plugins", plugins.error);
  const proC = plugins.data.find((plugin) => plugin.name === "FabFilter Pro-C 2");
  if (!proC) {
    throw new Error("plugins: FabFilter Pro-C 2 was not returned after insert");
  }

  const recipes = await client
    .from("recipes")
    .insert(
      OWN_RECIPES.map((recipe) => ({
        user_id: userId,
        intent: recipe.intent,
        required_type: recipe.required_type,
        steps: recipe.steps.map((text, index) => ({ id: `step-${index + 1}`, text })),
        image_data: imageData,
        image_mime: "image/png",
      })),
    )
    .select("id");
  ok("recipes", recipes.error);

  const nightRide = trackIds.get("Nocna jazda");
  const progress = await client.from("track_recipe_progress").upsert(
    [
      {
        track_id: nightRide,
        recipe_id: "sidechain-kick-bass",
        user_id: userId,
        completed_steps: SIDECHAIN_STEPS_DONE,
        selected_plugin_id: proC.id,
        use_native: false,
        updated_at: new Date().toISOString(),
      },
      {
        track_id: nightRide,
        recipe_id: "drum-bus-glue",
        user_id: userId,
        completed_steps: [],
        selected_plugin_id: null,
        use_native: true,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "track_id,recipe_id" },
  );
  ok("track_recipe_progress", progress.error);

  // Spread the notes over the last hours so the newest-first order is stable.
  const now = Date.now();
  const notes = await client.from("listening_notes").insert(
    NOTES.map((note, index) => ({
      track_id: trackIds.get(note.track),
      user_id: userId,
      equipment: note.equipment,
      body: note.body,
      stage: note.stage,
      created_at: new Date(now - (NOTES.length - index) * 3_600_000).toISOString(),
    })),
  );
  ok("listening_notes", notes.error);

  return {
    daw_profiles: 1,
    plugins: PLUGINS.length,
    tracks: TRACKS.length,
    track_recipe_progress: 2,
    recipes: OWN_RECIPES.length,
    listening_notes: NOTES.length,
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const { SUPABASE_URL, SUPABASE_KEY, DEMO_EMAIL, DEMO_PASSWORD } = process.env;
  const missing = ["SUPABASE_URL", "SUPABASE_KEY", "DEMO_EMAIL", "DEMO_PASSWORD"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(`Missing environment variables: ${missing.join(", ")}`);
  }

  let host;
  try {
    host = new URL(SUPABASE_URL).hostname;
  } catch {
    fail("SUPABASE_URL is not a valid URL");
  }

  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Account: ${DEMO_EMAIL}`);
  if (!LOCAL_HOSTS.has(host) && !process.argv.includes("--yes")) {
    fail("Refusing to seed a non-local Supabase project. Pass --yes to confirm the target above.");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let signIn = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signIn.error?.code === "invalid_credentials") {
    const signUp = await client.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (signUp.error) {
      fail(`Sign-in failed and sign-up failed too: ${signUp.error.message}`);
    }
    signIn = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  }
  if (signIn.error) {
    fail(`Sign-in failed: ${signIn.error.message}`);
  }

  const counts = await seedDemo(client, signIn.data.user.id);
  console.log("Seeded:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
