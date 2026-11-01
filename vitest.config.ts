import { defineConfig } from "vitest/config";
import { decorators } from "./scripts/decorators.mjs";

export default defineConfig({
  plugins: [decorators()],
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
    testTimeout: 5000,
    server: { deps: { inline: ["@deepseek-ai/dsh-client-ui-primitives"] } },
  },
});
