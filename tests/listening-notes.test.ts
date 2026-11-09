import { describe, expect, it } from "vitest";
import {
  equipmentSuggestions,
  formatNoteDate,
  listeningNoteInputSchema,
  listeningNoteRowSchema,
} from "../src/lib/listening-notes";

describe("listeningNoteInputSchema", () => {
  it("accepts 100-character equipment and rejects 101", () => {
    expect(listeningNoteInputSchema.safeParse({ equipment: "a".repeat(100), body: "ok" }).success).toBe(true);
    expect(listeningNoteInputSchema.safeParse({ equipment: "a".repeat(101), body: "ok" }).success).toBe(false);
  });

  it("rejects equipment made only of spaces", () => {
    expect(listeningNoteInputSchema.safeParse({ equipment: "   ", body: "ok" }).success).toBe(false);
  });

  it("accepts a 2000-character body and rejects 2001", () => {
    expect(listeningNoteInputSchema.safeParse({ equipment: "DT 770", body: "a".repeat(2000) }).success).toBe(true);
    expect(listeningNoteInputSchema.safeParse({ equipment: "DT 770", body: "a".repeat(2001) }).success).toBe(false);
  });

  it("rejects a body made only of spaces", () => {
    expect(listeningNoteInputSchema.safeParse({ equipment: "DT 770", body: "  \n " }).success).toBe(false);
  });

  it("trims surrounding spaces", () => {
    const parsed = listeningNoteInputSchema.parse({ equipment: "  DT 770 ", body: " Sub za głośny  " });
    expect(parsed).toEqual({ equipment: "DT 770", body: "Sub za głośny" });
  });
});

describe("listeningNoteRowSchema", () => {
  const row = {
    id: "3f1c5f0e-5b1a-4c55-9d0e-0a1b2c3d4e5f",
    equipment: "DT 770",
    body: "Sub za głośny",
    stage: "miks",
    created_at: "2026-11-09T09:05:00Z",
  };

  it("accepts a valid row", () => {
    expect(listeningNoteRowSchema.safeParse(row).success).toBe(true);
  });

  it("rejects an unknown stage", () => {
    expect(listeningNoteRowSchema.safeParse({ ...row, stage: "mix" }).success).toBe(false);
  });
});

describe("equipmentSuggestions", () => {
  it("de-duplicates case-insensitively keeping the newest spelling and drops empty values", () => {
    expect(equipmentSuggestions(["DT 770", "dt 770 ", "Samochód", "", "Monitory"])).toEqual([
      "DT 770",
      "Samochód",
      "Monitory",
    ]);
  });

  it("keeps the first 20 of 25 distinct values", () => {
    const values = Array.from({ length: 25 }, (_, i) => `Sprzęt ${i + 1}`);
    expect(equipmentSuggestions(values)).toEqual(values.slice(0, 20));
  });
});

describe("formatNoteDate", () => {
  it("formats winter time (CET)", () => {
    expect(formatNoteDate("2026-11-09T09:05:00Z")).toBe("09.11.2026, 10:05");
  });

  it("formats summer time (CEST)", () => {
    expect(formatNoteDate("2026-07-01T08:00:00Z")).toBe("01.07.2026, 10:00");
  });
});
