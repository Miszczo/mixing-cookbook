export interface RecipeChecklistMarkdownInput {
  intent: string;
  tool: { label: string; kind: "plugin" | "native" };
  steps: readonly { id: string; text: string }[];
  completedSteps: readonly string[];
}

/** Collapses every run of whitespace that contains a line break into one space. */
function toSingleLine(text: string): string {
  return text.replace(/\s*[\r\n]\s*/g, " ");
}

/** Renders a recipe, its done steps and the shown tool as the Markdown the user copies. */
export function recipeChecklistToMarkdown(input: RecipeChecklistMarkdownInput): string {
  const { intent, tool, steps, completedSteps } = input;
  const done = new Set(completedSteps);
  const toolLine = `Tool: ${tool.label}${tool.kind === "native" ? " (native)" : ""}`;
  const lines = [`## ${toSingleLine(intent)}`, "", toolLine];

  if (steps.length > 0) {
    lines.push("");
    for (const step of steps) {
      lines.push(`- [${done.has(step.id) ? "x" : " "}] ${toSingleLine(step.text)}`);
    }
  }

  return lines.join("\n");
}
