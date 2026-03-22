import { defineConfig } from "tsup";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const pluginFiles = readdirSync(join(import.meta.dirname, "src/plugins"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `src/plugins/${f}`);

export default defineConfig({
  entry: ["src/index.ts", ...pluginFiles],
  format: ["esm", "cjs"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
      dts: format === "esm" ? ".d.ts" : ".d.cts",
    };
  },
});
