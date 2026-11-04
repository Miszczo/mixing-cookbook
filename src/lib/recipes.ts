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
];

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
