import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.stryker-tmp/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
