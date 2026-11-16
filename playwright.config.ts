import { defineConfig, devices } from "@playwright/test";

const port = 3100;
// The "live" project (#254) runs a second app with a model configured: MODEL_API_URL points at a
// test-only stub model (e2e/support/stub-model.mjs), which is never part of the app bundle.
const livePort = 3101;
const stubPort = 3199;
// A test-only stand-in for Supabase (e2e/support/stub-supabase.mjs, #73): signed-in pages can be
// tested with seeded data. A visitor without its cookie is still signed out.
const supabaseStubPort = 3198;
// Set E2E_BASE_URL to test a deployed site; otherwise the app is built and started locally.
const deployed = process.env.E2E_BASE_URL;

// The server's prompt reader token (#282); the stub answers get_active_prompts only to it.
const promptsReadToken = "e2e-prompts-reader";
// The server's story content reader key (#284); the stub answers get_story_content only to it.
const contentReadKey = "e2e-content-reader";

const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${supabaseStubPort}`,
  PROMPTS_READ_TOKEN: promptsReadToken,
  CONTENT_READ_KEY: contentReadKey,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "playwright-placeholder",
  // Turns on the sign-in-free test path (#208) for the e2e servers only.
  PROTOTYPE_ENABLED: "1",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: deployed ?? `http://127.0.0.1:${port}` },
  projects: [
    { name: "mobile", testIgnore: /\.live\.spec\.ts$/, use: { ...devices["iPhone 14"] } },
    ...(deployed
      ? []
      : [
          {
            name: "mobile-live",
            testMatch: /\.live\.spec\.ts$/,
            use: { ...devices["iPhone 14"], baseURL: `http://127.0.0.1:${livePort}` },
          },
        ]),
  ],
  webServer: deployed
    ? undefined
    : [
        {
          command: "node e2e/support/stub-supabase.mjs",
          url: `http://127.0.0.1:${supabaseStubPort}/health`,
          env: {
            STUB_SUPABASE_PORT: String(supabaseStubPort),
            STUB_PROMPTS_READ_TOKEN: promptsReadToken,
            STUB_CONTENT_READ_KEY: contentReadKey,
          },
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: "node e2e/support/stub-model.mjs",
          url: `http://127.0.0.1:${stubPort}/health`,
          env: { STUB_MODEL_PORT: String(stubPort) },
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `npm run build && npx next start --port ${port}`,
          url: `http://127.0.0.1:${port}`,
          env: appEnv,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
        {
          // Starts once the first server is up, so the build is complete.
          command: `node e2e/support/wait-for-url.mjs http://127.0.0.1:${port} && npx next start --port ${livePort}`,
          url: `http://127.0.0.1:${livePort}`,
          env: {
            ...appEnv,
            MODEL_API_KEY: "stub",
            MODEL_API_URL: `http://127.0.0.1:${stubPort}/v1/chat/completions`,
            MODEL_NAME: "stub",
          },
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      ],
});
