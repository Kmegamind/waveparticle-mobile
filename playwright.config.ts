import { defineConfig, devices } from "@playwright/test";

const port = 3100;
// Set E2E_BASE_URL to test a deployed site; otherwise the app is built and started locally.
const deployed = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: deployed ?? `http://127.0.0.1:${port}` },
  projects: [{ name: "mobile", use: { ...devices["iPhone 14"] } }],
  webServer: deployed
    ? undefined
    : {
        command: `npm run build && npx next start --port ${port}`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
