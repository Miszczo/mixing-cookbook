import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PLUGIN_TYPES, pluginTypeLabel, type Plugin, type PluginTypeId } from "@/lib/plugins";
import type { PrimaryDawId } from "@/lib/primary-daw";

export interface Recipe {
  id: string;
  intent: string;
  requiredType: PluginTypeId;
  steps: readonly { id: string; text: string }[];
  screenshot: { src: string; alt: string };
}

const PLUGIN_TYPE_IDS = PLUGIN_TYPES.map((type) => type.id) as [PluginTypeId, ...PluginTypeId[]];

/** A stored own recipe, without the image: lists never read the image column. */
export const recipeRowSchema = z.object({
  id: z.uuid(),
  intent: z.string(),
  required_type: z.enum(PLUGIN_TYPE_IDS),
  steps: z.array(z.object({ id: z.string(), text: z.string() })),
});

export type RecipeRow = z.infer<typeof recipeRowSchema>;

export const RECIPE_COLUMNS = "id, intent, required_type, steps";

export function recipeFromRow(row: RecipeRow): Recipe {
  return {
    id: row.id,
    intent: row.intent,
    requiredType: row.required_type,
    steps: row.steps,
    screenshot: { src: `/api/recipes/${row.id}/image`, alt: `Zrzut ustawień: ${row.intent}` },
  };
}

export const RECIPES: readonly Recipe[] = [
  {
    id: "sidechain-kick-bass",
    intent: "Sidechain stopy z basem",
    requiredType: "compressor",
    steps: [
      { id: "insert-compressor", text: "Wstaw kompresor na ślad basu." },
      { id: "route-kick", text: "Ustaw stopę jako wejście sidechain kompresora." },
      { id: "ratio-attack", text: "Ustaw ratio na ok. 4:1 i szybki attack, ok. 1–5 ms." },
      { id: "threshold", text: "Obniżaj threshold, aż bas ściszy się o ok. 3–6 dB na każdym uderzeniu stopy." },
      { id: "release", text: "Ustaw release tak, żeby bas wracał przed kolejną stopą." },
      { id: "check-mix", text: "Sprawdź efekt w całym miksie, włączając i wyłączając kompresor." },
    ],
    screenshot: {
      src: "/recipes/sidechain-settings-mock.png",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień kompresora (atrapa)",
    },
  },
  {
    id: "drum-bus-glue",
    intent: "Klej na sumie perkusji",
    requiredType: "compressor",
    steps: [
      { id: "insert-on-bus", text: "Wstaw kompresor na sumę perkusji (drum bus)." },
      { id: "ratio-attack", text: "Ustaw ratio na ok. 2:1 i attack na 10–30 ms, żeby uderzenia zachowały swój pazur." },
      { id: "release", text: "Dobierz release tak, żeby kompresor wracał do zera w tempie utworu." },
      {
        id: "threshold",
        text: "Obniżaj threshold, aż wskaźnik pokaże ok. 1–3 dB redukcji wzmocnienia na mocnych uderzeniach.",
      },
      { id: "makeup-gain", text: "Wyrównaj głośność makeup gain, żeby po włączeniu kompresora nie brzmiało głośniej." },
      { id: "check-mix", text: "Porównaj perkusję z kompresorem i bez niego w całym miksie." },
    ],
    screenshot: {
      src: "/recipes/drum-bus-glue-mock.svg",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień kompresora na sumie perkusji (atrapa)",
    },
  },
  {
    id: "vocal-low-cut",
    intent: "Wyczyść dół wokalu",
    requiredType: "eq",
    steps: [
      { id: "insert-eq", text: "Wstaw korektor (EQ) na ślad wokalu." },
      { id: "high-pass", text: "Włącz filtr górnoprzepustowy (high-pass) i przesuwaj go od ok. 60 Hz w górę." },
      { id: "listen-body", text: "Zatrzymaj się tuż przed miejscem, w którym wokal traci ciało i ciepło." },
      {
        id: "mud-cut",
        text: "Opcjonalnie zrób szerokie, delikatne cięcie w okolicy 200–400 Hz, jeśli wokal brzmi muliście.",
      },
      { id: "check-mix", text: "Sprawdź efekt w całym miksie, włączając i wyłączając korektor." },
    ],
    screenshot: {
      src: "/recipes/vocal-low-cut-mock.svg",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień korektora na wokalu (atrapa)",
    },
  },
  {
    id: "snare-plate-reverb",
    intent: "Pogłos płytowy na werbel",
    requiredType: "reverb",
    steps: [
      { id: "create-send", text: "Utwórz ścieżkę zwrotną (return) i wstaw na niej pogłos." },
      { id: "plate-preset", text: "Wybierz algorytm płytowy (plate) i wyłącz w nim wszelkie dodatkowe modulacje." },
      { id: "pre-delay", text: "Ustaw pre-delay na 10–30 ms, żeby uderzenie werbla zostało przed pogłosem." },
      { id: "decay", text: "Ustaw decay na ok. 1–1,5 s, tak żeby ogon kończył się przed kolejnym uderzeniem." },
      {
        id: "filter-return",
        text: "Odfiltruj return: obetnij niskie tony poniżej ok. 200 Hz i szczyt wysokich tonów.",
      },
      { id: "send-level", text: "Dozuj wysyłkę werbla, aż pogłos będzie wyczuwalny, ale nie zasłoni werbla." },
    ],
    screenshot: {
      src: "/recipes/snare-plate-reverb-mock.svg",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień pogłosu płytowego (atrapa)",
    },
  },
  {
    id: "vocal-throw-delay",
    intent: "Echo na końcówkach fraz wokalu",
    requiredType: "delay",
    steps: [
      { id: "create-send", text: "Utwórz ścieżkę zwrotną (return) i wstaw na niej delay." },
      { id: "sync-time", text: "Włącz synchronizację z tempem i ustaw czas na 1/4 lub 1/8." },
      { id: "feedback", text: "Ustaw feedback na ok. 20–35%, żeby powtórki wygasały po kilku odbiciach." },
      {
        id: "filter-return",
        text: "Odfiltruj return: obetnij niskie i najwyższe tony, żeby echo nie zagłuszało wokalu.",
      },
      { id: "automate-send", text: "Zautomatyzuj wysyłkę wokalu tak, żeby otwierała się tylko na końcówkach fraz." },
      { id: "check-mix", text: "Posłuchaj w całym miksie, czy echo nie zasłania początku kolejnej frazy." },
    ],
    screenshot: {
      src: "/recipes/vocal-throw-delay-mock.svg",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień delaya na wokalu (atrapa)",
    },
  },
  {
    id: "bass-saturation",
    intent: "Saturacja basu na małe głośniki",
    requiredType: "saturation",
    steps: [
      { id: "insert-saturator", text: "Wstaw saturator na ślad basu." },
      { id: "drive", text: "Zwiększaj drive, aż w basie pojawią się wyraźne wyższe harmoniczne." },
      { id: "mix", text: "Ustaw mix na ok. 30–50%, żeby zachować czysty dół obok nasyconej części." },
      { id: "level-match", text: "Wyrównaj głośność wyjściową, żeby porównanie było uczciwe." },
      {
        id: "small-speakers",
        text: "Sprawdź bas na małych głośnikach lub słuchawkach: powinien być słyszalny bez podbijania dołu.",
      },
    ],
    screenshot: {
      src: "/recipes/bass-saturation-mock.svg",
      alt: "Przykładowa grafika w miejscu zrzutu ustawień saturatora na basie (atrapa)",
    },
  },
];

export type RecipeSource = "starter" | "own";

export interface ListedRecipe {
  recipe: Recipe;
  source: RecipeSource;
}

export const recipeSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .transform((value) => value.slice(0, 100))
    .default("")
    .catch(""),
  type: z
    .enum([...PLUGIN_TYPE_IDS, "all"])
    .default("all")
    .catch("all"),
  source: z.enum(["all", "starter", "own"]).default("all").catch("all"),
});

export type RecipeSearch = z.infer<typeof recipeSearchSchema>;

/** Lower case without diacritics; ł does not decompose under NFD, so it is mapped explicitly. */
export function normalizeIntent(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l");
}

export function filterRecipes(items: readonly ListedRecipe[], search: RecipeSearch): ListedRecipe[] {
  const words = normalizeIntent(search.q).split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      (search.type === "all" || item.recipe.requiredType === search.type) &&
      (search.source === "all" || item.source === search.source) &&
      words.every((word) => normalizeIntent(item.recipe.intent).includes(word)),
  );
}

export async function findRecipe(supabase: SupabaseClient, id: string): Promise<Recipe | null | "error"> {
  const starter = RECIPES.find((recipe) => recipe.id === id);
  if (starter) {
    return starter;
  }
  if (!z.uuid().safeParse(id).success) {
    return null;
  }

  const result = await supabase.from("recipes").select(RECIPE_COLUMNS).eq("id", id).maybeSingle();
  if (result.error) {
    return "error";
  }
  if (!result.data) {
    return null;
  }
  const parsed = recipeRowSchema.safeParse(result.data);
  if (!parsed.success) {
    return "error";
  }
  return recipeFromRow(parsed.data);
}

/** Only the compressor has named native tools; other types use the generic label. */
const NATIVE_TOOLS: Partial<Record<PluginTypeId, Record<PrimaryDawId, string>>> = {
  compressor: {
    "ableton-live": "Compressor",
    "fl-studio": "Fruity Limiter (sekcja kompresji)",
    "logic-pro": "Compressor",
    "bitwig-studio": "Compressor",
    reaper: "ReaComp",
  },
};

function genericNativeLabel(type: PluginTypeId): string {
  return type === "compressor"
    ? "natywny kompresor Twojego DAW"
    : `natywne narzędzie Twojego DAW (${pluginTypeLabel(type)})`;
}

export type Tool = { kind: "plugin"; id: string; label: string } | { kind: "native"; label: string };

/** `auto`, `native`, or the id of a chosen plugin. */
export type ToolChoice = string;

export const progressRowSchema = z.object({
  recipe_id: z.string(),
  completed_steps: z.array(z.string()),
  selected_plugin_id: z.uuid().nullable(),
  use_native: z.boolean(),
});

export type RecipeProgress = z.infer<typeof progressRowSchema>;

export const PROGRESS_COLUMNS = "recipe_id, completed_steps, selected_plugin_id, use_native";

export function choiceFromProgress(progress: RecipeProgress | undefined): ToolChoice {
  if (progress?.use_native) {
    return "native";
  }
  return progress?.selected_plugin_id ?? "auto";
}

export interface ToolSelection {
  /** The tool the card shows, after applying the manual choice. */
  tool: Tool;
  /** The tool the rule picks on its own. */
  suggested: Tool;
  compatible: Plugin[];
  native: Extract<Tool, { kind: "native" }>;
}

function byFavoriteThenName(a: Plugin, b: Plugin): number {
  if (a.is_favorite !== b.is_favorite) {
    return a.is_favorite ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function pluginTool(plugin: Plugin): Tool {
  return { kind: "plugin", id: plugin.id, label: plugin.name };
}

export function selectTool(input: {
  plugins: readonly Plugin[];
  dawId: PrimaryDawId | null;
  requiredType: PluginTypeId;
  choice: ToolChoice;
}): ToolSelection {
  const { plugins, dawId, requiredType, choice } = input;
  const compatible = plugins.filter((plugin) => plugin.plugin_type === requiredType).sort(byFavoriteThenName);
  const native = {
    kind: "native",
    label: (dawId ? NATIVE_TOOLS[requiredType]?.[dawId] : undefined) ?? genericNativeLabel(requiredType),
  } as const;
  const suggested = compatible.length > 0 ? pluginTool(compatible[0]) : native;
  const chosen = compatible.find((plugin) => plugin.id === choice);

  let tool = suggested;
  if (choice === "native") {
    tool = native;
  } else if (chosen) {
    tool = pluginTool(chosen);
  }

  return { tool, suggested, compatible, native };
}
