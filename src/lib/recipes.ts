import { z } from "zod";
import type { Plugin } from "@/lib/plugins";
import type { PrimaryDawId } from "@/lib/primary-daw";

export type RecipeToolType = "compressor";

export interface Recipe {
  id: string;
  intent: string;
  requiredType: RecipeToolType;
  steps: readonly { id: string; text: string }[];
  screenshot: { src: string; alt: string };
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

const NATIVE_TOOLS: Record<RecipeToolType, Record<PrimaryDawId, string>> = {
  compressor: {
    "ableton-live": "Compressor",
    "fl-studio": "Fruity Limiter (sekcja kompresji)",
    "logic-pro": "Compressor",
    "bitwig-studio": "Compressor",
    reaper: "ReaComp",
  },
};

const GENERIC_NATIVE_TOOLS: Record<RecipeToolType, string> = {
  compressor: "natywny kompresor Twojego DAW",
};

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
  requiredType: RecipeToolType;
  choice: ToolChoice;
}): ToolSelection {
  const { plugins, dawId, requiredType, choice } = input;
  const compatible = plugins.filter((plugin) => plugin.plugin_type === requiredType).sort(byFavoriteThenName);
  const native = {
    kind: "native",
    label: dawId ? NATIVE_TOOLS[requiredType][dawId] : GENERIC_NATIVE_TOOLS[requiredType],
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
