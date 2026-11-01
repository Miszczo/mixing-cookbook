/// <reference types="vitest/globals" />
import { selectTool } from "@/lib/recipes";
import type { Plugin } from "@/lib/plugins";
import type { PrimaryDawId } from "@/lib/primary-daw";

const GENERIC_NATIVE = "natywny kompresor Twojego DAW";

function plugin(id: string, name: string, overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: `00000000-0000-4000-8000-00000000000${id}`,
    name,
    plugin_type: "compressor",
    is_favorite: false,
    ...overrides,
  };
}

function select(plugins: Plugin[], dawId: PrimaryDawId | null, choice: Parameters<typeof selectTool>[0]["choice"]) {
  return selectTool({ plugins, dawId, requiredType: "compressor", choice });
}

describe("selectTool", () => {
  it("suggests the first favorite alphabetically, ahead of an earlier non-favorite", () => {
    const plugins = [
      plugin("1", "Zeta Comp", { is_favorite: true }),
      plugin("2", "Alpha Comp"),
      plugin("3", "beta comp", { is_favorite: true }),
    ];

    const result = select(plugins, "reaper", "auto");

    expect(result.tool).toMatchObject({ kind: "plugin", label: "beta comp" });
    expect(result.suggested).toMatchObject({ kind: "plugin", label: "beta comp" });
    expect(result.compatible.map((item) => item.name)).toEqual(["beta comp", "Zeta Comp", "Alpha Comp"]);
  });

  it("prefers a non-favorite compressor over the native tool, with id breaking a name tie", () => {
    const plugins = [plugin("2", "Glue"), plugin("1", "glue"), plugin("3", "Pro-C")];

    const result = select(plugins, "ableton-live", "auto");

    expect(result.tool).toMatchObject({ kind: "plugin", id: plugins[1].id });
    expect(result.native.label).toBe("Compressor");
  });

  it.each<[PrimaryDawId, string]>([
    ["ableton-live", "Compressor"],
    ["fl-studio", "Fruity Limiter (sekcja kompresji)"],
    ["logic-pro", "Compressor"],
    ["bitwig-studio", "Compressor"],
    ["reaper", "ReaComp"],
  ])("falls back to the native tool of %s when no plugin matches the type", (dawId, label) => {
    const plugins = [plugin("1", "Valhalla", { plugin_type: "reverb", is_favorite: true })];

    const result = select(plugins, dawId, "auto");

    expect(result.tool).toMatchObject({ kind: "native", label });
    expect(result.suggested).toMatchObject({ kind: "native", label });
    expect(result.compatible).toEqual([]);
  });

  it("names a generic native tool when there is no plugin and no DAW", () => {
    const result = select([], null, "auto");

    expect(result.tool).toMatchObject({ kind: "native", label: GENERIC_NATIVE });
    expect(result.native.label).toBe(GENERIC_NATIVE);
  });

  it("applies a manual choice but keeps the automatic suggestion", () => {
    const favorite = plugin("1", "Pro-C", { is_favorite: true });
    const other = plugin("2", "Glue");

    const native = select([favorite, other], "reaper", "native");
    expect(native.tool).toMatchObject({ kind: "native", label: "ReaComp" });
    expect(native.suggested).toMatchObject({ kind: "plugin", label: "Pro-C" });

    const chosen = select([favorite, other], "reaper", other.id);
    expect(chosen.tool).toMatchObject({ kind: "plugin", label: "Glue" });
  });

  it("treats a chosen plugin that is gone or no longer compatible as automatic", () => {
    const favorite = plugin("1", "Pro-C", { is_favorite: true });
    const reverb = plugin("2", "Valhalla", { plugin_type: "reverb" });

    expect(select([favorite], "reaper", plugin("9", "Deleted").id).tool).toMatchObject({ label: "Pro-C" });
    expect(select([favorite, reverb], "reaper", reverb.id).tool).toMatchObject({ label: "Pro-C" });
    expect(select([reverb], "reaper", reverb.id).tool).toMatchObject({ kind: "native", label: "ReaComp" });
  });
});
