/// <reference types="vitest/globals" />
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_TYPES } from "../src/lib/plugins";
import { RECIPES } from "../src/lib/recipes";

const PUBLIC_DIR = join(__dirname, "..", "public");

describe("starter recipe catalog", () => {
  it("has unique recipe ids", () => {
    const ids = RECIPES.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has kebab-case step ids, unique within a recipe, with valid text lengths", () => {
    for (const recipe of RECIPES) {
      const stepIds = recipe.steps.map((step) => step.id);
      expect(new Set(stepIds).size, recipe.id).toBe(stepIds.length);
      for (const step of recipe.steps) {
        expect(step.id, `${recipe.id}/${step.id}`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(step.id.length, `${recipe.id}/${step.id}`).toBeLessThanOrEqual(20);
        expect(step.text.length, `${recipe.id}/${step.id}`).toBeGreaterThanOrEqual(1);
        expect(step.text.length, `${recipe.id}/${step.id}`).toBeLessThanOrEqual(200);
      }
    }
  });

  it("points every screenshot at an existing file under public/", () => {
    for (const recipe of RECIPES) {
      expect(recipe.screenshot.src.startsWith("/"), recipe.id).toBe(true);
      expect(existsSync(join(PUBLIC_DIR, recipe.screenshot.src)), recipe.screenshot.src).toBe(true);
    }
  });

  it("has at least one starter for every plugin type except other", () => {
    for (const type of PLUGIN_TYPES) {
      if (type.id === "other") continue;
      expect(
        RECIPES.some((recipe) => recipe.requiredType === type.id),
        type.id,
      ).toBe(true);
    }
  });

  it("keeps the sidechain starter intent and its first and last step", () => {
    const sidechain = RECIPES.find((recipe) => recipe.id === "sidechain-kick-bass");
    expect(sidechain).toBeDefined();
    expect(sidechain?.intent).toBe("Sidechain stopy z basem");
    expect(sidechain?.steps[0]).toEqual({ id: "insert-compressor", text: "Wstaw kompresor na ślad basu." });
    expect(sidechain?.steps.at(-1)).toEqual({
      id: "check-mix",
      text: "Sprawdź efekt w całym miksie, włączając i wyłączając kompresor.",
    });
  });
});
