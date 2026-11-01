import { z } from "zod";

export const TRACK_STAGES = [
  { id: "aranz", label: "Aranż" },
  { id: "miks", label: "Miks" },
  { id: "master", label: "Master" },
] as const;

export type TrackStageId = (typeof TRACK_STAGES)[number]["id"];

const TRACK_STAGE_IDS = TRACK_STAGES.map((stage) => stage.id) as [TrackStageId, ...TrackStageId[]];

export const trackInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  stage: z.enum(TRACK_STAGE_IDS),
});

export const trackRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  stage: z.enum(TRACK_STAGE_IDS),
});

export type Track = z.infer<typeof trackRowSchema>;

export const TRACK_COLUMNS = "id, name, stage";

export function trackStageLabel(id: TrackStageId): string {
  return TRACK_STAGES.find((stage) => stage.id === id)?.label ?? id;
}
