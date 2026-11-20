import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_TEXT_FIELDS, logEvent, type LogSink } from "@/lib/logging/server-log";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { seedPromptSource } from "./support/seed-prompts";

// #135: problems can be found in production without storing what users wrote.

const root = path.resolve(import.meta.dirname, "..");

function capture() {
  const lines: { level: string; line: string }[] = [];
  const sink: LogSink = (level, line) => lines.push({ level, line });
  return { lines, sink, entries: () => lines.map((entry) => JSON.parse(entry.line)) };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server log helper (#135)", () => {
  it("test_135_ac1_logs_feature_event_request_id_and_duration_as_one_json_line", () => {
    const log = capture();
    logEvent(
      "model-gateway",
      { event: "model_call_failed", call: "plan_split", reason: "timeout" },
      { requestId: "req-1", durationMs: 8123, level: "error", sink: log.sink },
    );

    expect(log.lines).toHaveLength(1);
    expect(log.lines[0].level).toBe("error");
    expect(log.entries()[0]).toEqual({
      level: "error",
      feature: "model-gateway",
      event: "model_call_failed",
      requestId: "req-1",
      durationMs: 8123,
      call: "plan_split",
      reason: "timeout",
    });
  });

  it("test_135_ac1_gives_each_entry_a_request_id_when_none_is_passed", () => {
    const log = capture();
    logEvent("prompts", { event: "prompt_missing", key: "plan_split" }, { sink: log.sink });
    logEvent("prompts", { event: "prompt_missing", key: "plan_split" }, { sink: log.sink });

    const [first, second] = log.entries();
    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.requestId).not.toBe(first.requestId);
    expect(first.level).toBe("warn");
  });

  it("test_135_ac2_a_user_text_field_fails", () => {
    for (const field of ["goal", "step", "chat", "card", "text", "message", "title", "email"]) {
      expect(USER_TEXT_FIELDS).toContain(field);
      const log = capture();
      expect(() =>
        logEvent("story-cards", { event: "story_cards_read_failed", [field]: "x" } as never, {
          sink: log.sink,
        }),
      ).toThrow(new RegExp(`"${field}"`));
      expect(log.lines).toHaveLength(0);
    }
  });

  it("test_135_ac2_free_text_under_a_safe_name_fails", () => {
    const log = capture();
    const goal = "Write the grant report for my manager";
    expect(() =>
      logEvent("prompts", { event: "prompt_read_failed", key: goal }, { sink: log.sink }),
    ).toThrow(/"key"/);
    expect(() =>
      logEvent("prompts", { event: goal.replaceAll(" ", "_").padEnd(80, "x") }, { sink: log.sink }),
    ).toThrow(/"event"/);
    expect(log.lines).toHaveLength(0);
  });

  it("test_135_ac2_in_production_a_refused_field_is_named_but_its_value_is_never_written", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = capture();
    logEvent(
      "story-content",
      { event: "story_content_read_failed", goal: "SECRET_GOAL_TEXT" } as never,
      { sink: log.sink },
    );

    expect(log.lines).toHaveLength(1);
    expect(log.lines[0].line).not.toContain("SECRET_GOAL_TEXT");
    expect(log.entries()[0]).toMatchObject({
      feature: "story-content",
      event: "log_refused",
      refusedFields: ["goal"],
    });
  });

  it("test_135_ac2_no_code_in_src_logs_except_through_the_helper", () => {
    const helper = path.join(root, "src/lib/logging/server-log.ts");
    const offenders = sourceFiles(path.join(root, "src"))
      .filter((file) => file !== helper)
      .filter((file) => /\bconsole\.(log|info|warn|error|debug)\b/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });

  it("test_135_ac1_the_server_gateway_logs_failed_and_slow_calls_without_user_text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const gateway = createServerModelGateway({
      prompts: seedPromptSource(),
      env: { MODEL_API_KEY: "k", MODEL_API_URL: "https://models.example/v1", MODEL_NAME: "m" },
      maxAttempts: 1,
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });

    const plan = await gateway.splitPlan({
      goal: "SECRET_GOAL_TEXT",
      totalMinutes: 15,
      splitFiner: false,
    });

    expect(plan.source).toBe("failed");
    const lines = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("SECRET_GOAL_TEXT");
    expect(lines[0]).not.toContain("network down");
    expect(JSON.parse(lines[0])).toMatchObject({
      level: "error",
      feature: "model-gateway",
      event: "model_call_failed",
      call: "plan_split",
      reason: "request",
      durationMs: expect.any(Number),
      requestId: expect.any(String),
    });
  });

  it("test_135_ac3_deploy_doc_says_where_to_look_and_how_long_logs_are_kept", () => {
    const doc = readFileSync(path.join(root, "docs/deploy.md"), "utf8");
    expect(doc).toMatch(/## Server logs/);
    expect(doc).toMatch(/Runtime Logs/);
    expect(doc).toMatch(/1 hour/);
    expect(doc).toMatch(/1 day/);
    expect(doc).toContain("src/lib/logging/server-log.ts");
  });
});
