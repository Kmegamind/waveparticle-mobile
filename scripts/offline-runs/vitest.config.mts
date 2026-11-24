import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The offline runs (#42) only. Started by scripts/offline-runs/run.mjs, never by `npm test` or CI
// (the main config includes tests/**/*.test.ts only).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: {
    include: ["scripts/offline-runs/runner.offline.ts"],
    root: fileURLToPath(new URL("../..", import.meta.url)),
    testTimeout: 0,
    hookTimeout: 0,
    fileParallelism: false,
    // The runner prints where it wrote the report.
    silent: false,
  },
});
