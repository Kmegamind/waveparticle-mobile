import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// #269: the e2e ports come from environment variables, so parallel sessions do not block each
// other. With no variables the run is the same as before (3100, 3101, 3199).

type Server = { command: string; url: string; env?: Record<string, string> };
type Config = {
  use: { baseURL: string };
  projects: { name: string; use: { baseURL?: string } }[];
  webServer: Server[];
};

const names = ["E2E_PORT", "E2E_LIVE_PORT", "E2E_STUB_PORT", "E2E_BASE_URL"] as const;
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));

async function loadConfig(env: Partial<Record<(typeof names)[number], string>>): Promise<Config> {
  for (const name of names) delete process.env[name];
  Object.assign(process.env, env);
  vi.resetModules();
  return (await import("../playwright.config")).default as unknown as Config;
}

function summary(config: Config) {
  const live = config.projects.find((project) => project.name === "mobile-live")!;
  const stub = config.webServer.find((server) => server.command.includes("stub-model"))!;
  const app = config.webServer.find((server) => server.command.includes("npm run build"))!;
  const liveApp = config.webServer.at(-1)!;
  return {
    baseURL: config.use.baseURL,
    liveBaseURL: live.use.baseURL,
    stubUrl: stub.url,
    stubEnv: stub.env?.STUB_MODEL_PORT,
    appCommand: app.command,
    liveCommand: liveApp.command,
    liveModelUrl: liveApp.env?.MODEL_API_URL,
  };
}

afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.resetModules();
});

describe("e2e ports (#269)", () => {
  it("test_269_ac1_reads_the_ports_from_environment_variables", async () => {
    const config = summary(
      await loadConfig({ E2E_PORT: "4100", E2E_LIVE_PORT: "4101", E2E_STUB_PORT: "4199" }),
    );

    expect(config).toEqual({
      baseURL: "http://127.0.0.1:4100",
      liveBaseURL: "http://127.0.0.1:4101",
      stubUrl: "http://127.0.0.1:4199/health",
      stubEnv: "4199",
      appCommand: "npm run build && npx next start --port 4100",
      liveCommand:
        "node e2e/support/wait-for-url.mjs http://127.0.0.1:4100 && npx next start --port 4101",
      liveModelUrl: "http://127.0.0.1:4199/v1/chat/completions",
    });
  });

  it("test_269_ac3_defaults_are_3100_3101_and_3199", async () => {
    const config = summary(await loadConfig({}));

    expect(config).toEqual({
      baseURL: "http://127.0.0.1:3100",
      liveBaseURL: "http://127.0.0.1:3101",
      stubUrl: "http://127.0.0.1:3199/health",
      stubEnv: "3199",
      appCommand: "npm run build && npx next start --port 3100",
      liveCommand:
        "node e2e/support/wait-for-url.mjs http://127.0.0.1:3100 && npx next start --port 3101",
      liveModelUrl: "http://127.0.0.1:3199/v1/chat/completions",
    });
  });

  it("test_269_ac1_rejects_a_port_that_is_not_a_number", async () => {
    await expect(loadConfig({ E2E_PORT: "abc" })).rejects.toThrow(/E2E_PORT/);
  });

  it("test_269_ac2_live_spec_and_stub_use_the_shared_stub_port", async () => {
    vi.resetModules();
    process.env.E2E_STUB_PORT = "4199";
    const { e2ePorts } = await import("../e2e/support/ports");
    expect(e2ePorts.stub).toBe(4199);

    const spec = readFileSync("e2e/other-story.live.spec.ts", "utf8");
    expect(spec).not.toContain("3199");
    expect(spec).toContain("e2ePorts.stub");

    const stub = readFileSync("e2e/support/stub-model.mjs", "utf8");
    expect(stub).toMatch(
      /process\.env\.STUB_MODEL_PORT \?\? process\.env\.E2E_STUB_PORT \?\? "3199"/,
    );
  });

  it("test_269_ac4_testing_doc_explains_other_ports", () => {
    const doc = readFileSync("docs/testing.md", "utf8");
    for (const name of ["E2E_PORT", "E2E_LIVE_PORT", "E2E_STUB_PORT"]) expect(doc).toContain(name);
  });
});
