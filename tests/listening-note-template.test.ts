import { describe, expect, it } from "vitest";
import { LISTENING_NOTE_TEMPLATE, appendListeningNoteTemplate } from "../src/lib/listening-note-template";

const MAX = 2000;

describe("LISTENING_NOTE_TEMPLATE", () => {
  it("has the five labels and fits in 2000 characters", () => {
    expect(LISTENING_NOTE_TEMPLATE.split("\n")).toEqual([
      "Vocals: ",
      "Low end: ",
      "Stereo / width: ",
      "Loudness: ",
      "To fix next: ",
    ]);
    expect(LISTENING_NOTE_TEMPLATE.length).toBeLessThanOrEqual(MAX);
  });
});

describe("appendListeningNoteTemplate", () => {
  it("returns the template for an empty field", () => {
    expect(appendListeningNoteTemplate("", MAX)).toEqual({ text: LISTENING_NOTE_TEMPLATE, inserted: true });
  });

  it("returns the template for a whitespace-only field", () => {
    expect(appendListeningNoteTemplate("  \n ", MAX)).toEqual({ text: LISTENING_NOTE_TEMPLATE, inserted: true });
  });

  it("keeps typed text verbatim and adds a blank line before the template", () => {
    const result = appendListeningNoteTemplate("Sub too loud", MAX);
    expect(result.inserted).toBe(true);
    expect(result.text).toBe(`Sub too loud\n\n${LISTENING_NOTE_TEMPLATE}`);
  });

  it("does not double trailing newlines", () => {
    const result = appendListeningNoteTemplate("Sub too loud\n\n\n", MAX);
    expect(result.text).toBe(`Sub too loud\n\n${LISTENING_NOTE_TEMPLATE}`);
  });

  it("inserts when the result is exactly max characters", () => {
    const prefix = "a".repeat(MAX - LISTENING_NOTE_TEMPLATE.length - 2);
    const result = appendListeningNoteTemplate(prefix, MAX);
    expect(result.inserted).toBe(true);
    expect(result.text.length).toBe(MAX);
  });

  it("refuses at max + 1 characters and leaves the text unchanged", () => {
    const current = "a".repeat(MAX - LISTENING_NOTE_TEMPLATE.length - 1);
    const result = appendListeningNoteTemplate(current, MAX);
    expect(result).toEqual({ text: current, inserted: false });
  });
});
