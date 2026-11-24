/// <reference types="vitest/globals" />
import { formatImageSize, pasteMessage, pastedFileName, planPaste } from "@/lib/recipe-image-paste";

// Unit convention: 1 KB = 1024 bytes, 1 MB = 1_048_576 bytes.
const MB = 1_048_576;

const png = { type: "image/png", size: 1000 };

function plan(
  files: { type: string; size: number }[],
  options: { hasText?: boolean; targetIsTextField?: boolean; maxBytes?: number | null } = {},
) {
  return planPaste({
    files,
    hasText: options.hasText ?? false,
    targetIsTextField: options.targetIsTextField ?? false,
    maxBytes: options.maxBytes === undefined ? MB : options.maxBytes,
  });
}

describe("planPaste", () => {
  it("attaches an image-only clipboard from a text field and from outside one", () => {
    expect(plan([png], { targetIsTextField: true })).toEqual({ action: "attach", index: 0 });
    expect(plan([png], { targetIsTextField: false })).toEqual({ action: "attach", index: 0 });
  });

  it("attaches image plus text outside a text field but ignores it inside one", () => {
    expect(plan([png], { hasText: true, targetIsTextField: false })).toEqual({ action: "attach", index: 0 });
    expect(plan([png], { hasText: true, targetIsTextField: true })).toEqual({ action: "ignore" });
  });

  it("ignores a text-only clipboard in a text field and rejects it with no-image outside", () => {
    expect(plan([], { hasText: true, targetIsTextField: true })).toEqual({ action: "ignore" });
    expect(plan([], { hasText: true, targetIsTextField: false })).toEqual({ action: "reject", reason: "no-image" });
  });

  it("rejects an empty clipboard and a non-image file with no-image", () => {
    const pdf = { type: "application/pdf", size: 10 };
    expect(plan([])).toEqual({ action: "reject", reason: "no-image" });
    expect(plan([pdf])).toEqual({ action: "reject", reason: "no-image" });
    expect(plan([], { targetIsTextField: true })).toEqual({ action: "reject", reason: "no-image" });
    expect(plan([pdf], { targetIsTextField: true })).toEqual({ action: "reject", reason: "no-image" });
  });

  it("rejects image types other than PNG, JPEG and WebP", () => {
    expect(plan([{ type: "image/gif", size: 10 }])).toEqual({ action: "reject", reason: "unsupported-type" });
    expect(plan([{ type: "image/svg+xml", size: 10 }])).toEqual({ action: "reject", reason: "unsupported-type" });
  });

  it("attaches JPEG and WebP", () => {
    expect(plan([{ type: "image/jpeg", size: 10 }])).toEqual({ action: "attach", index: 0 });
    expect(plan([{ type: "image/webp", size: 10 }])).toEqual({ action: "attach", index: 0 });
  });

  it("attaches a size exactly at the limit and rejects one byte over", () => {
    expect(plan([{ type: "image/png", size: 1_048_576 }])).toEqual({ action: "attach", index: 0 });
    expect(plan([{ type: "image/png", size: 1_048_577 }])).toEqual({
      action: "reject",
      reason: "too-large",
      size: 1_048_577,
    });
  });

  it("never rejects for size when the limit is null", () => {
    expect(plan([{ type: "image/png", size: 50_000_000 }], { maxBytes: null })).toEqual({
      action: "attach",
      index: 0,
    });
  });

  it("uses the first image and reports its index", () => {
    const files = [
      { type: "text/plain", size: 5 },
      { type: "image/webp", size: 20 },
      { type: "image/png", size: 30 },
    ];
    expect(plan(files)).toEqual({ action: "attach", index: 1 });
  });

  it("judges only the first image when several are present", () => {
    const files = [
      { type: "image/gif", size: 20 },
      { type: "image/png", size: 30 },
    ];
    expect(plan(files)).toEqual({ action: "reject", reason: "unsupported-type" });
  });
});

describe("pasteMessage", () => {
  it("explains a clipboard without an image", () => {
    expect(pasteMessage({ action: "reject", reason: "no-image" }, MB)).toBe(
      "The clipboard has no image. Copy a screenshot and paste again, or choose a file.",
    );
  });

  it("explains an unsupported type", () => {
    expect(pasteMessage({ action: "reject", reason: "unsupported-type" }, MB)).toBe(
      "Only PNG, JPEG or WebP images can be pasted. Copy a screenshot, or choose a file.",
    );
  });

  it("rounds the size up so a size just over the limit never reads as equal to it", () => {
    const message = pasteMessage({ action: "reject", reason: "too-large", size: 1_048_577 }, MB);
    expect(message).toBe(
      "The pasted image is 1.1 MB; the limit is 1 MB. Take a smaller screenshot or choose a smaller file.",
    );
    expect(message).not.toContain("1.0 MB");
  });

  it("shows a whole-number size with one decimal and a fractional limit as is", () => {
    // 3 MB image, 2.5 MB limit (2_621_440 bytes)
    expect(pasteMessage({ action: "reject", reason: "too-large", size: 3 * MB }, 2_621_440)).toBe(
      "The pasted image is 3.0 MB; the limit is 2.5 MB. Take a smaller screenshot or choose a smaller file.",
    );
  });

  it("does not throw when the limit is missing for a too-large plan", () => {
    expect(() => pasteMessage({ action: "reject", reason: "too-large", size: 2 * MB }, null)).not.toThrow();
  });
});

describe("pastedFileName", () => {
  it("maps the type to an extension", () => {
    expect(pastedFileName("image/png")).toBe("pasted-screenshot.png");
    expect(pastedFileName("image/jpeg")).toBe("pasted-screenshot.jpg");
    expect(pastedFileName("image/webp")).toBe("pasted-screenshot.webp");
  });
});

describe("formatImageSize", () => {
  it("shows whole KB below 1 MB", () => {
    expect(formatImageSize(820 * 1024)).toBe("820 KB");
    expect(formatImageSize(1536)).toBe("2 KB");
  });

  it("never shows 1024 KB: one byte under 1 MB reads as 1.0 MB", () => {
    expect(formatImageSize(1_048_575)).toBe("1.0 MB");
  });

  it("shows one-decimal MB at and above 1 MB", () => {
    expect(formatImageSize(1_048_576)).toBe("1.0 MB");
    expect(formatImageSize(1_258_291)).toBe("1.2 MB");
  });
});
