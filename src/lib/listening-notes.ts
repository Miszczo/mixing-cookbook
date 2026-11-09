import { z } from "zod";
import { TRACK_STAGE_IDS } from "@/lib/tracks";

export const MAX_EQUIPMENT_LENGTH = 100;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_EQUIPMENT_SUGGESTIONS = 20;

export const listeningNoteInputSchema = z.object({
  equipment: z.string().trim().min(1).max(MAX_EQUIPMENT_LENGTH),
  body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
});

export const listeningNoteRowSchema = z.object({
  id: z.uuid(),
  equipment: z.string(),
  body: z.string(),
  stage: z.enum(TRACK_STAGE_IDS),
  created_at: z.string(),
});

export type ListeningNote = z.infer<typeof listeningNoteRowSchema>;

export const LISTENING_NOTE_COLUMNS = "id, equipment, body, stage, created_at";

/** Input is newest first; keeps the newest spelling of each name, case-insensitively. */
export function equipmentSuggestions(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length === MAX_EQUIPMENT_SUGGESTIONS) break;
  }
  return result;
}

const warsawFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `dd.MM.yyyy, HH:mm` in Warsaw time, built from parts so it does not depend on the ICU short format. */
export function formatNoteDate(iso: string): string {
  const parts = Object.fromEntries(warsawFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}
