import { describe, expect, it } from "vitest";
import { recipeChecklistToMarkdown } from "../src/lib/recipe-checklist-markdown";

const STEPS = [
  { id: "insert", text: "Wstaw kompresor na bas" },
  { id: "route", text: "Ustaw sidechain na stopę" },
];

describe("recipeChecklistToMarkdown", () => {
  it("marks done and undone steps in order", () => {
    const result = recipeChecklistToMarkdown({
      intent: "Sidechain stopy z basem",
      tool: { label: "Pro-C 2", kind: "plugin" },
      steps: STEPS,
      completedSteps: ["insert"],
    });
    expect(result).toBe(
      "## Sidechain stopy z basem\n\nTool: Pro-C 2\n\n- [x] Wstaw kompresor na bas\n- [ ] Ustaw sidechain na stopę",
    );
  });

  it("appends (native) for a native tool", () => {
    const result = recipeChecklistToMarkdown({
      intent: "Intent",
      tool: { label: "ReaComp", kind: "native" },
      steps: STEPS,
      completedSteps: [],
    });
    expect(result.split("\n")[2]).toBe("Tool: ReaComp (native)");
  });

  it("keeps step text with line breaks on one line", () => {
    const result = recipeChecklistToMarkdown({
      intent: "Intent",
      tool: { label: "Pro-C 2", kind: "plugin" },
      steps: [{ id: "a", text: "First line\n  second line\r\n\r\nthird" }],
      completedSteps: [],
    });
    expect(result).toBe("## Intent\n\nTool: Pro-C 2\n\n- [ ] First line second line third");
  });

  it("ignores completed ids that are not in steps", () => {
    const result = recipeChecklistToMarkdown({
      intent: "Intent",
      tool: { label: "Pro-C 2", kind: "plugin" },
      steps: STEPS,
      completedSteps: ["gone", "route"],
    });
    expect(result).toBe("## Intent\n\nTool: Pro-C 2\n\n- [ ] Wstaw kompresor na bas\n- [x] Ustaw sidechain na stopę");
  });

  it("ends after the Tool line when there are no steps", () => {
    const result = recipeChecklistToMarkdown({
      intent: "Intent",
      tool: { label: "Pro-C 2", kind: "plugin" },
      steps: [],
      completedSteps: ["insert"],
    });
    expect(result).toBe("## Intent\n\nTool: Pro-C 2");
  });
});
