import { z } from "zod";
import { PLUGIN_TYPES, type PluginTypeId } from "@/lib/plugins";

export const MAX_IMAGE_BYTES = 1_048_576;
export const MAX_STEPS = 20;
export const MAX_STEP_LENGTH = 200;
export const MAX_INTENT_LENGTH = 100;

export type RecipeImageMime = "image/png" | "image/jpeg" | "image/webp";

const PLUGIN_TYPE_IDS = PLUGIN_TYPES.map((type) => type.id) as [PluginTypeId, ...PluginTypeId[]];

export const recipeInputSchema = z.object({
  intent: z.string().trim().min(1).max(MAX_INTENT_LENGTH),
  required_type: z.enum(PLUGIN_TYPE_IDS),
  steps: z.array(z.string().min(1).max(MAX_STEP_LENGTH)).min(1).max(MAX_STEPS),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

/** One step per line; blank lines are dropped. */
export function parseStepLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function buildSteps(lines: readonly string[]): { id: string; text: string }[] {
  return lines.map((text, index) => ({ id: `step-${index + 1}`, text }));
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return (
    bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value)
  );
}

/** Decides the type from the file's own bytes; the browser-reported type is never trusted. */
export function sniffImage(bytes: Uint8Array): RecipeImageMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

const CHUNK = 0x8000;

export function encodeImage(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export function decodeImage(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
