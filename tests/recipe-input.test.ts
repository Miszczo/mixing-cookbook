/// <reference types="vitest/globals" />
import {
  MAX_IMAGE_BYTES,
  buildSteps,
  decodeImage,
  encodeImage,
  parseStepLines,
  recipeInputSchema,
  sniffImage,
} from "@/lib/recipe-input";

const valid = { intent: "Czyszczenie dołu w wokalu", required_type: "eq", steps: ["Wstaw EQ."] };

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

describe("parseStepLines", () => {
  it("trims lines and drops blank ones between steps", () => {
    expect(parseStepLines("  Pierwszy  \n\n\t\nDrugi\r\n   \nTrzeci")).toEqual(["Pierwszy", "Drugi", "Trzeci"]);
  });

  it("returns no steps for empty or whitespace-only text", () => {
    expect(parseStepLines("")).toEqual([]);
    expect(parseStepLines(" \n \r\n ")).toEqual([]);
  });
});

describe("buildSteps", () => {
  it("numbers steps from one with stable ids", () => {
    expect(buildSteps(["A", "B"])).toEqual([
      { id: "step-1", text: "A" },
      { id: "step-2", text: "B" },
    ]);
  });
});

describe("recipeInputSchema", () => {
  it("accepts a valid recipe and trims the intent", () => {
    const parsed = recipeInputSchema.safeParse({ ...valid, intent: "  Sidechain  " });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.intent).toBe("Sidechain");
  });

  it("accepts every plugin type as the required type", () => {
    for (const type of ["compressor", "eq", "reverb", "delay", "saturation", "other"]) {
      expect(recipeInputSchema.safeParse({ ...valid, required_type: type }).success).toBe(true);
    }
  });

  it("rejects an unknown tool type", () => {
    expect(recipeInputSchema.safeParse({ ...valid, required_type: "limiter" }).success).toBe(false);
  });

  it("rejects an empty or blank intent and accepts 100 characters but not 101", () => {
    expect(recipeInputSchema.safeParse({ ...valid, intent: "" }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ ...valid, intent: "   " }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ ...valid, intent: "a".repeat(100) }).success).toBe(true);
    expect(recipeInputSchema.safeParse({ ...valid, intent: "a".repeat(101) }).success).toBe(false);
  });

  it("accepts 20 steps but not 21 and not zero", () => {
    const steps = (count: number) => Array.from({ length: count }, (_, index) => `Krok ${index + 1}`);

    expect(recipeInputSchema.safeParse({ ...valid, steps: steps(20) }).success).toBe(true);
    expect(recipeInputSchema.safeParse({ ...valid, steps: steps(21) }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ ...valid, steps: [] }).success).toBe(false);
  });

  it("accepts a 200 character step but not 201", () => {
    expect(recipeInputSchema.safeParse({ ...valid, steps: ["a".repeat(200)] }).success).toBe(true);
    expect(recipeInputSchema.safeParse({ ...valid, steps: ["a".repeat(201)] }).success).toBe(false);
  });

  it("counts characters, not UTF-16 units, so Polish letters and emoji are not over-counted", () => {
    expect(recipeInputSchema.safeParse({ ...valid, steps: ["ą".repeat(200)] }).success).toBe(true);
  });
});

describe("sniffImage", () => {
  it("recognizes a PNG by its signature", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
  });

  it("recognizes a JPEG by its first three bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
  });

  it("recognizes a WebP by RIFF and WEBP markers", () => {
    const riff = [0x52, 0x49, 0x46, 0x46];
    const size = [0x1a, 0, 0, 0];
    const webp = [0x57, 0x45, 0x42, 0x50];
    expect(sniffImage(bytes(...riff, ...size, ...webp, 0x56, 0x50))).toBe("image/webp");
  });

  it("rejects a RIFF file that is not WebP, such as a WAV", () => {
    const wave = [0x57, 0x41, 0x56, 0x45];
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, ...wave))).toBeNull();
  });

  it("rejects text renamed to .png, an empty file and a truncated signature", () => {
    expect(sniffImage(new TextEncoder().encode("This is not an image at all"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(bytes(0x89, 0x50, 0x4e))).toBeNull();
  });

  it("rejects GIF and SVG", () => {
    expect(sniffImage(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });
});

describe("image encoding", () => {
  it("round-trips every byte value", () => {
    const original = Uint8Array.from({ length: 256 }, (_, index) => index);

    expect(Array.from(decodeImage(encodeImage(original)))).toEqual(Array.from(original));
  });

  it("round-trips an image of the maximum size", () => {
    const original = new Uint8Array(MAX_IMAGE_BYTES).map((_, index) => index % 251);

    const decoded = decodeImage(encodeImage(original));

    expect(decoded.length).toBe(MAX_IMAGE_BYTES);
    expect(decoded[MAX_IMAGE_BYTES - 1]).toBe((MAX_IMAGE_BYTES - 1) % 251);
  });

  it("keeps a maximum-size image within the 1 400 000 character column limit", () => {
    expect(encodeImage(new Uint8Array(MAX_IMAGE_BYTES)).length).toBeLessThanOrEqual(1_400_000);
  });

  it("writes standard base64 text", () => {
    expect(encodeImage(new TextEncoder().encode("Man"))).toBe("TWFu");
  });
});
