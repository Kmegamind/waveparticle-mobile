import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// #319: the Supabase stub port comes from E2E_SUPABASE_PORT (default 3198), like the other three
// e2e ports (#269), so concurrent sessions stop sharing the stub's seeded data.

type Server = { command: string; url: string; env?: Record<string, string> };
type Config = { webServer: Server[] };

const names = [
  "E2E_PORT",
  "E2E_LIVE_PORT",
  "E2E_STUB_PORT",
  "E2E_SUPABASE_PORT",
  "E2E_BASE_URL",
] as const;
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));

function setEnv(env: Partial<Record<(typeof names)[number], string>>) {
  for (const name of names) delete process.env[name];
  Object.assign(process.env, env);
  vi.resetModules();
}

async function supabaseSummary(env: Partial<Record<(typeof names)[number], string>>) {
  setEnv(env);
  const config = (await import("../playwright.config")).default as unknown as Config;
  const stub = config.webServer.find((server) => server.command.includes("stub-supabase"))!;
  const apps = config.webServer.filter((server) => server.command.includes("next start"));
  return {
    stubUrl: stub.url,
    stubEnv: stub.env?.STUB_SUPABASE_PORT,
    appSupabaseUrls: apps.map((app) => app.env?.NEXT_PUBLIC_SUPABASE_URL),
  };
}

afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.resetModules();
});

describe("e2e Supabase stub port (#319)", () => {
  it("test_319_ac1_reads_the_supabase_stub_port_from_E2E_SUPABASE_PORT", async () => {
    expect(await supabaseSummary({ E2E_SUPABASE_PORT: "3798" })).toEqual({
      stubUrl: "http://127.0.0.1:3798/health",
      stubEnv: "3798",
      appSupabaseUrls: ["http://127.0.0.1:3798", "http://127.0.0.1:3798"],
    });
  });

  it("test_319_ac3_the_default_is_3198", async () => {
    expect(await supabaseSummary({})).toEqual({
      stubUrl: "http://127.0.0.1:3198/health",
      stubEnv: "3198",
      appSupabaseUrls: ["http://127.0.0.1:3198", "http://127.0.0.1:3198"],
    });
  });

  it("test_319_ac1_rejects_a_supabase_port_that_is_not_a_number", async () => {
    setEnv({ E2E_SUPABASE_PORT: "stub" });
    await expect(import("../e2e/support/ports")).rejects.toThrow(/E2E_SUPABASE_PORT/);
  });

  it("test_319_ac2_the_e2e_helpers_reach_the_stub_and_app_on_the_configured_ports", async () => {
    setEnv({ E2E_PORT: "3700", E2E_SUPABASE_PORT: "3798" });
    const account = await import("../e2e/support/account");
    expect(account.STUB_SUPABASE).toBe("http://127.0.0.1:3798");
    expect(account.baseUrlOf({ url: () => "about:blank" } as never)).toBe("http://127.0.0.1:3700");

    const source = readFileSync("e2e/support/account.ts", "utf8");
    expect(source).not.toMatch(/3198|3100/);

    const stub = readFileSync("e2e/support/stub-supabase.mjs", "utf8");
    expect(stub).toMatch(
      /process\.env\.STUB_SUPABASE_PORT \?\? process\.env\.E2E_SUPABASE_PORT \?\? "3198"/,
    );
  });

  it("test_319_ac4_testing_doc_names_the_variable_with_a_four_port_example", () => {
    const doc = readFileSync("docs/testing.md", "utf8");
    expect(doc).toContain("E2E_SUPABASE_PORT");
    expect(doc).toMatch(
      /E2E_PORT=\d+ E2E_LIVE_PORT=\d+ E2E_STUB_PORT=\d+ E2E_SUPABASE_PORT=\d+ npm run test:e2e/,
    );
    expect(doc).not.toContain("The Supabase stub stays on 3198");
  });
});
