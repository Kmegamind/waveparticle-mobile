import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROMPT_CACHE_MS,
  createPromptRepository,
  readActivePromptsFromSupabase,
  type PromptLog,
  type PromptRow,
} from "@/lib/prompts/repository";

const row = (key: PromptRow["key"], version = 1): PromptRow => ({
  key,
  version,
  body: `Body of ${key} v${version}`,
  params: {},
});

function setup(rows: () => Promise<PromptRow[]>) {
  let clock = 1_000;
  const logs: PromptLog[] = [];
  let reads = 0;
  const repository = createPromptRepository({
    readRows: async () => {
      reads += 1;
      return rows();
    },
    now: () => clock,
    log: (event) => logs.push(event),
  });
  return {
    repository,
    logs,
    reads: () => reads,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("prompt repository (#282)", () => {
  it("test_282_returns_the_active_row_for_a_key", async () => {
    const { repository } = setup(async () => [row("rest_reply"), row("plan_split", 3)]);
    expect(await repository.getActivePrompt("plan_split")).toEqual(row("plan_split", 3));
  });

  it("test_282_reads_the_table_once_for_all_keys_within_the_cache_time", async () => {
    const t = setup(async () => [row("rest_reply"), row("plan_split")]);
    await Promise.all([
      t.repository.getActivePrompt("rest_reply"),
      t.repository.getActivePrompt("plan_split"),
    ]);
    t.advance(PROMPT_CACHE_MS - 1);
    await t.repository.getActivePrompt("rest_reply");
    expect(t.reads()).toBe(1);
  });

  it("test_282_a_new_active_version_is_used_within_one_minute", async () => {
    let version = 1;
    const t = setup(async () => [row("rest_reply", version)]);
    expect((await t.repository.getActivePrompt("rest_reply"))?.version).toBe(1);
    version = 2;
    t.advance(PROMPT_CACHE_MS);
    expect((await t.repository.getActivePrompt("rest_reply"))?.version).toBe(2);
    expect(PROMPT_CACHE_MS).toBeLessThanOrEqual(60_000);
  });

  it("test_282_a_missing_key_returns_null_and_logs_the_key_only", async () => {
    const t = setup(async () => [row("rest_reply")]);
    expect(await t.repository.getActivePrompt("closing_line")).toBeNull();
    expect(t.logs).toEqual([{ event: "prompt_missing", key: "closing_line" }]);
  });

  it("test_282_a_failed_read_returns_null_and_is_not_cached", async () => {
    let fail = true;
    const t = setup(async () => {
      if (fail) throw new Error("network down");
      return [row("rest_reply")];
    });
    expect(await t.repository.getActivePrompt("rest_reply")).toBeNull();
    expect(t.logs).toEqual([{ event: "prompt_read_failed", key: "rest_reply" }]);
    fail = false;
    expect(await t.repository.getActivePrompt("rest_reply")).toEqual(row("rest_reply"));
  });
});

describe("reading the table on the server (#282)", () => {
  it("test_282_without_the_reader_token_nothing_is_read", async () => {
    await expect(
      readActivePromptsFromSupabase({
        env: { NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" },
      }),
    ).rejects.toThrow(/PROMPTS_READ_TOKEN/);
  });

  it("test_282_an_empty_answer_is_a_failed_read_not_every_prompt_missing", async () => {
    // A wrong or unregistered token gets no rows from get_active_prompts, and no error.
    await expect(
      readActivePromptsFromSupabase({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
          PROMPTS_READ_TOKEN: "unregistered",
        },
        fetchImpl: async () =>
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
      }),
    ).rejects.toThrow(/no active prompts/);
  });

  it("test_282_a_hanging_read_is_given_up_after_its_time_limit", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const started = Date.now();
    await expect(
      readActivePromptsFromSupabase({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
          PROMPTS_READ_TOKEN: "t",
        },
        fetchImpl,
        timeoutMs: 50,
      }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("test_282_calls_get_active_prompts_with_the_token_and_keeps_only_known_keys", async () => {
    const requests: { url: string; body: string; headers: Headers }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        body: String(init?.body ?? ""),
        headers: new Headers(init?.headers),
      });
      return new Response(
        JSON.stringify([
          { key: "rest_reply", version: 2, body: "B", params: { checks: {} } },
          { key: "not_a_gateway_key", version: 1, body: "X", params: {} },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const rows = await readActivePromptsFromSupabase({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        PROMPTS_READ_TOKEN: "secret-token",
      },
      fetchImpl,
    });
    expect(rows).toEqual([{ key: "rest_reply", version: 2, body: "B", params: { checks: {} } }]);
    expect(requests[0].url).toBe("http://127.0.0.1:3198/rest/v1/rpc/get_active_prompts");
    expect(JSON.parse(requests[0].body)).toEqual({ reader_token: "secret-token" });
    expect(requests[0].headers.get("apikey")).toBe("anon");
  });

  it("test_282_the_prompts_and_their_token_stay_out_of_client_code", () => {
    const sourceRoot = path.join(import.meta.dirname, "..", "src");
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const full = path.join(directory, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(sourceRoot);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!/^["']use client["']/m.test(text)) continue;
      expect(text, file).not.toMatch(/lib\/prompts|PROMPTS_READ_TOKEN|model-gateway\/server/);
    }
    const all = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(all).not.toMatch(/NEXT_PUBLIC_PROMPTS/);
  });
});
