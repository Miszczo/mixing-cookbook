/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";
import type { PluginOption } from "vite";

const astroViteConfig = getViteConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    // HTTP tests each boot one astro dev server; run files one at a time.
    fileParallelism: false,
  },
});

const CLOUDFLARE_MODULE_RUNNER_PLUGIN = "vite-plugin-cloudflare:dev";

function withoutCloudflareModuleRunner(plugins: PluginOption[] | undefined): PluginOption[] {
  return (plugins ?? []).flatMap((plugin) => {
    if (Array.isArray(plugin)) return [withoutCloudflareModuleRunner(plugin)];
    if (plugin && typeof plugin === "object" && "name" in plugin && plugin.name === CLOUDFLARE_MODULE_RUNNER_PLUGIN) {
      return [];
    }
    return [plugin];
  });
}

export default async (env: Parameters<typeof astroViteConfig>[0]) => {
  const config = await astroViteConfig(env);
  return {
    ...config,
    plugins: withoutCloudflareModuleRunner(config.plugins),
  };
};
