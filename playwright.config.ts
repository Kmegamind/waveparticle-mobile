import { defineConfig, devices } from "@playwright/test";
import { e2ePorts } from "./e2e/support/ports";

// Ports come from E2E_PORT, E2E_LIVE_PORT, E2E_STUB_PORT (#269) and E2E_SUPABASE_PORT (#319);
// defaults 3100, 3101, 3199 and 3198.
const port = e2ePorts.app;
// The "live" project (#254) runs a second app with a model configured: MODEL_API_URL points at a
// test-only stub model (e2e/support/stub-model.mjs), which is never part of the app bundle.
const livePort = e2ePorts.live;
const stubPort = e2ePorts.stub;
// A test-only stand-in for Supabase (e2e/support/stub-supabase.mjs, #73): signed-in pages can be
// tested with seeded data. A visitor without its cookie is still signed out.
const supabaseStubPort = e2ePorts.supabase;
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
  // Signs the goal dialogue's turns (#31). `next start` runs in production mode, where a missing
  // key refuses every turn; this test-only value is not used anywhere else.
  GOAL_DIALOGUE_SECRET: "e2e-goal-dialogue-key-for-tests-only-0001",
};

// #435, #483: the admin visual gate, one file per admin page (e2e/admin-visual.spec.ts for the
// frame and shared components, e2e/admin-visual-<page>.spec.ts for each page).
const ADMIN_VISUAL_GATE = /(?:^|\/)admin-visual(?:-[a-z-]+)?\.spec\.ts$/;

// #445: every e2e file that writes app text (save, publish, roll back or reset of app_text).
const APP_TEXT_WRITERS = /(?:^|\/)(?:app-text|publish-history)\.spec\.ts$/;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: deployed ?? `http://127.0.0.1:${port}` },
  projects: [
    {
      name: "mobile",
      testIgnore: [/\.live\.spec\.ts$/, ADMIN_VISUAL_GATE, APP_TEXT_WRITERS],
      use: { ...devices["iPhone 14"] },
    },
    // #445: the files that write the stub's one app_text table run one at a time, never beside
    // each other (App text's Publish changes lists every key's draft). One worker for this project
    // only; the other projects keep running beside it.
    {
      name: "app-text",
      testMatch: APP_TEXT_WRITERS,
      workers: 1,
      use: { ...devices["iPhone 14"] },
    },
    // #435: the admin visual gate runs in a desktop browser (the admin is desktop only). #483: every
    // file of the gate; each test signs in its own account, so the files run in any order.
    {
      name: "desktop",
      testMatch: ADMIN_VISUAL_GATE,
      use: { ...devices["Desktop Chrome"] },
    },
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
            // The test stage runs with no per-browser daily limit (#256, TEST-NO-CAP).
            MODEL_CALL_LIMIT_ENABLED: "0",
            // #476: a test price for the stub model only (invented; no real price is written in
            // the repository), so the prompt lab's cost can be tested.
            AI_RUN_PRICES: JSON.stringify({
              stub: { input_per_million_tokens: 1, output_per_million_tokens: 2 },
            }),
          },
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
        },
      ],
});
