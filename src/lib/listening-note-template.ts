export const LISTENING_NOTE_TEMPLATE = [
  "Vocals: ",
  "Low end: ",
  "Stereo / width: ",
  "Loudness: ",
  "To fix next: ",
].join("\n");

export interface AppendTemplateResult {
  text: string;
  inserted: boolean;
}

/**
 * Appends the listening-note template after whatever the user already typed.
 * Never removes typed text; refuses (inserted: false) when the result would
 * be longer than `max`.
 */
export function appendListeningNoteTemplate(current: string, max: number): AppendTemplateResult {
  const text = current.trim() === "" ? LISTENING_NOTE_TEMPLATE : `${current.trimEnd()}\n\n${LISTENING_NOTE_TEMPLATE}`;
  if (text.length > max) {
    return { text: current, inserted: false };
  }
  return { text, inserted: true };
}
