const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1_048_576;
const PASTEABLE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface PasteFile {
  type: string;
  size: number;
}

export interface PasteInput {
  files: readonly PasteFile[];
  hasText: boolean;
  targetIsTextField: boolean;
  maxBytes: number | null;
}

export interface PasteRejectPlan {
  action: "reject";
  reason: "no-image" | "unsupported-type" | "too-large";
  size?: number;
}

export type PastePlan = { action: "ignore" } | { action: "attach"; index: number } | PasteRejectPlan;

/** Rules in order: pick image files, let text win inside a text field, then judge the first image. */
export function planPaste(input: PasteInput): PastePlan {
  const { files, hasText, targetIsTextField, maxBytes } = input;
  const textWins = targetIsTextField && hasText;
  const index = files.findIndex((file) => file.type.startsWith("image/"));

  if (index === -1) {
    return textWins ? { action: "ignore" } : { action: "reject", reason: "no-image" };
  }
  if (textWins) {
    return { action: "ignore" };
  }

  const file = files[index];
  if (!PASTEABLE_TYPES.includes(file.type)) {
    return { action: "reject", reason: "unsupported-type" };
  }
  if (maxBytes !== null && file.size > maxBytes) {
    return { action: "reject", reason: "too-large", size: file.size };
  }
  return { action: "attach", index };
}

export function pasteMessage(plan: PasteRejectPlan, maxBytes: number | null): string {
  if (plan.reason === "no-image") {
    return "The clipboard has no image. Copy a screenshot and paste again, or choose a file.";
  }
  if (plan.reason === "unsupported-type") {
    return "Only PNG, JPEG or WebP images can be pasted. Copy a screenshot, or choose a file.";
  }
  if (plan.size === undefined || maxBytes === null) {
    return "The pasted image is too large. Take a smaller screenshot or choose a smaller file.";
  }
  // Round the size up so a size just over the limit never reads as equal to it.
  const sizeMb = (Math.ceil((plan.size / BYTES_PER_MB) * 10) / 10).toFixed(1);
  const limitMb = (maxBytes / BYTES_PER_MB).toFixed(1).replace(/\.0$/, "");
  return `The pasted image is ${sizeMb} MB; the limit is ${limitMb} MB. Take a smaller screenshot or choose a smaller file.`;
}

export function pastedFileName(mime: string): string {
  if (mime === "image/jpeg") {
    return "pasted-screenshot.jpg";
  }
  if (mime === "image/webp") {
    return "pasted-screenshot.webp";
  }
  return "pasted-screenshot.png";
}

export function formatImageSize(bytes: number): string {
  const kilobytes = Math.round(bytes / BYTES_PER_KB);
  // A size that rounds up to 1024 KB is shown as MB, never as "1024 KB".
  if (bytes < BYTES_PER_MB && kilobytes < BYTES_PER_KB) {
    return `${kilobytes} KB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}
