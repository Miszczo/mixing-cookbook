/// <reference types="vitest/globals" />
import { filterRecipes, recipeSearchSchema, type ListedRecipe, type Recipe } from "@/lib/recipes";
import type { PluginTypeId } from "@/lib/plugins";

function listed(id: string, intent: string, requiredType: PluginTypeId, source: ListedRecipe["source"]): ListedRecipe {
  const recipe: Recipe = { id, intent, requiredType, steps: [], screenshot: { src: "", alt: "" } };
  return { recipe, source };
}

const vocal = listed("vocal", "Czyszczenie dołu w wokalu", "eq", "own");
const sidechain = listed("sidechain", "Sidechain stopy z basem", "compressor", "starter");
const glue = listed("glue", "Klejenie grupy perkusji", "compressor", "own");
const ITEMS = [vocal, sidechain, glue];

function search(params: Record<string, string>) {
  return filterRecipes(ITEMS, recipeSearchSchema.parse(params));
}

describe("filterRecipes", () => {
  it("matches words regardless of case and diacritics, including ł", () => {
    expect(search({ q: "DOL wokal" })).toEqual([vocal]);
  });

  it("matches every word in any order", () => {
    expect(search({ q: "stopy sidechain" })).toEqual([sidechain]);
  });

  it("returns nothing when a word matches no intent", () => {
    expect(search({ q: "reverb" })).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(search({})).toEqual(ITEMS);
    expect(search({ q: "   " })).toEqual(ITEMS);
  });

  it("keeps only recipes of the chosen type", () => {
    expect(search({ type: "compressor" })).toEqual([sidechain, glue]);
  });

  it("drops starter recipes when the source is own", () => {
    expect(search({ source: "own" })).toEqual([vocal, glue]);
  });

  it("treats an invalid type or source as all", () => {
    expect(recipeSearchSchema.parse({ type: "xyz", source: "xyz" })).toMatchObject({ type: "all", source: "all" });
    expect(search({ type: "xyz" })).toEqual(ITEMS);
  });

  it("keeps the input order", () => {
    const reversed = [...ITEMS].reverse();

    expect(filterRecipes(reversed, recipeSearchSchema.parse({ q: "" }))).toEqual(reversed);
  });
});
