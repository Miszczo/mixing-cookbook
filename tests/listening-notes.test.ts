import { describe, expect, it } from "vitest";
import {
  distinctEquipment,
  equipmentFilterOptions,
  equipmentSuggestions,
  escapeLikePattern,
  exactMatchRegex,
  formatNoteDate,
  listeningNoteInputSchema,
  listeningNoteOverviewRowSchema,
  listeningNoteRowSchema,
  notesFilterSchema,
  sameEquipment,
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

describe("notesFilterSchema", () => {
  it("defaults a missing value to an empty string", () => {
    expect(notesFilterSchema.parse({})).toEqual({ equipment: "" });
  });

  it("trims and keeps a valid value", () => {
    expect(notesFilterSchema.parse({ equipment: "  DT 770 " })).toEqual({ equipment: "DT 770" });
  });

  it("turns a blank value into an empty string", () => {
    expect(notesFilterSchema.parse({ equipment: "   " })).toEqual({ equipment: "" });
  });

  it("keeps 100 characters and falls back to an empty string for 101", () => {
    expect(notesFilterSchema.parse({ equipment: "a".repeat(100) }).equipment).toBe("a".repeat(100));
    expect(notesFilterSchema.parse({ equipment: "a".repeat(101) })).toEqual({ equipment: "" });
  });

  it("falls back to an empty string for a non-string value", () => {
    expect(notesFilterSchema.parse({ equipment: 5 })).toEqual({ equipment: "" });
    expect(notesFilterSchema.parse({ equipment: ["a", "b"] })).toEqual({ equipment: "" });
  });
});

describe("distinctEquipment", () => {
  it("de-duplicates case-insensitively keeping the newest spelling and drops empty values", () => {
    expect(distinctEquipment(["DT 770", "dt 770 ", "Samochód", "", "DT 770 Pro"])).toEqual([
      "DT 770",
      "Samochód",
      "DT 770 Pro",
    ]);
  });

  it("does not cap the result at 20", () => {
    const values = Array.from({ length: 25 }, (_, i) => `Sprzęt ${i + 1}`);
    expect(distinctEquipment(values)).toEqual(values);
  });
});

describe("equipmentFilterOptions", () => {
  it("sorts alphabetically, placing Polish letters correctly", () => {
    expect(equipmentFilterOptions(["Żyrafa", "Zebra", "Samochód", "Słuchawki", "Ącki", "Adam"])).toEqual([
      "Adam",
      "Ącki",
      "Samochód",
      "Słuchawki",
      "Zebra",
      "Żyrafa",
    ]);
  });

  it("de-duplicates before sorting", () => {
    expect(equipmentFilterOptions(["dt 770", "Monitory", "DT 770"])).toEqual(["dt 770", "Monitory"]);
  });
});

describe("sameEquipment", () => {
  it("matches case-insensitively", () => {
    expect(sameEquipment("DT 770", "dt 770")).toBe(true);
    expect(sameEquipment("SAMOCHÓD", "samochód")).toBe(true);
  });

  it("ignores surrounding spaces", () => {
    expect(sameEquipment(" DT 770 ", "dt 770")).toBe(true);
  });

  it("does not match a different name", () => {
    expect(sameEquipment("DT 770", "DT 770 Pro")).toBe(false);
  });
});

describe("exactMatchRegex", () => {
  it("anchors the value and escapes regex metacharacters including *", () => {
    expect(exactMatchRegex("Mic*")).toBe("^Mic\\*$");
    expect(exactMatchRegex(" DT 770 (Pro) ")).toBe("^DT 770 \\(Pro\\)$");
    expect(exactMatchRegex("a.b|c\\d")).toBe("^a\\.b\\|c\\\\d$");
  });
});

describe("escapeLikePattern", () => {
  it("escapes backslash, percent and underscore", () => {
    expect(escapeLikePattern("50% _x\\")).toBe("50\\% \\_x\\\\");
  });

  it("leaves other text untouched", () => {
    expect(escapeLikePattern("DT 770")).toBe("DT 770");
  });
});

describe("listeningNoteOverviewRowSchema", () => {
  const row = {
    id: "3f1c5f0e-5b1a-4c55-9d0e-0a1b2c3d4e5f",
    equipment: "DT 770",
    body: "Sub za głośny",
    stage: "miks",
    created_at: "2026-11-09T09:05:00Z",
    track_id: "7a2d9b34-1c6e-4f08-8a53-2b9e4d6c1f70",
    tracks: { name: "Utwór 1" },
  };

  it("accepts a row with an embedded track", () => {
    expect(listeningNoteOverviewRowSchema.safeParse(row).success).toBe(true);
  });

  it("rejects a row without tracks", () => {
    const { tracks: _tracks, ...withoutTracks } = row;
    expect(listeningNoteOverviewRowSchema.safeParse(withoutTracks).success).toBe(false);
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
