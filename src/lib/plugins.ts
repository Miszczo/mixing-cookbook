import { z } from "zod";

export const PLUGIN_TYPES = [
  { id: "compressor", label: "Compressor" },
  { id: "eq", label: "EQ" },
  { id: "reverb", label: "Reverb" },
  { id: "delay", label: "Delay" },
  { id: "saturation", label: "Saturation" },
  { id: "other", label: "Other" },
] as const;

export type PluginTypeId = (typeof PLUGIN_TYPES)[number]["id"];

const PLUGIN_TYPE_IDS = PLUGIN_TYPES.map((type) => type.id) as [PluginTypeId, ...PluginTypeId[]];

export const pluginInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  plugin_type: z.enum(PLUGIN_TYPE_IDS),
});

export const pluginRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  plugin_type: z.enum(PLUGIN_TYPE_IDS),
  is_favorite: z.boolean(),
});

export type Plugin = z.infer<typeof pluginRowSchema>;

export const PLUGIN_COLUMNS = "id, name, plugin_type, is_favorite";

export function pluginTypeLabel(id: PluginTypeId): string {
  return PLUGIN_TYPES.find((type) => type.id === id)?.label ?? id;
}
