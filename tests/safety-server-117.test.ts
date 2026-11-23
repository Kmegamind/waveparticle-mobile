import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { promptRowProblems } from "@/lib/model-gateway";
import type { PromptRow } from "@/lib/prompts/repository";
import { safetyClassifierSettings, serverSafetyCheckFrom } from "@/lib/safety/server";
import { seedPromptSource, seedRows } from "./support/seed-prompts";

// US-SAF-4 (#117): the classifier runs through the same provider settings as the gateway, with
// optional separate settings (owner decision of 2026-11-22, SAFETY-PROVIDER).

const row = seedRows().find((seed) => seed.key === "safety_classifier") as PromptRow;

describe("#117 the classifier prompt", () => {
  it("test_117_the_seed_prompt_is_usable_and_states_the_tiers", () => {
    expect(row).toBeDefined();
    expect(promptRowProblems(row)).toEqual([]);
    for (const word of ['"crisis"', '"stress"', '"none"', '"unsure"']) {
      expect(row.body).toContain(word);
    }
    expect(row.body).not.toMatch(/low_mood|lang/);
  });

  it("test_117_a_row_with_an_unknown_placeholder_cannot_be_published", () => {
    expect(promptRowProblems({ ...row, body: `${row.body}\n{{goal}}` })).toEqual([
      "Unknown {{goal}} in the prompt.",
    ]);
  });
});

describe("#117 the server's settings", () => {
  const model = { MODEL_API_KEY: "k", MODEL_API_URL: "https://m.test", MODEL_NAME: "chat" };

  it("test_117_uses_the_gateway_settings_by_default", () => {
    expect(safetyClassifierSettings(model)).toEqual({
      apiKey: "k",
      apiUrl: "https://m.test",
      model: "chat",
    });
  });

  it("test_117_separate_safety_settings_replace_each_one_given", () => {
    expect(
      safetyClassifierSettings({ ...model, SAFETY_MODEL_NAME: "small", SAFETY_MODEL_API_KEY: "s" }),
    ).toEqual({ apiKey: "s", apiUrl: "https://m.test", model: "small" });
  });

  it("test_117_without_a_model_there_is_no_classifier_and_no_alarm", async () => {
    expect(safetyClassifierSettings({})).toBeNull();
    const fetchImpl = vi.fn();
    const check = serverSafetyCheckFrom({
      env: { SAFETY_ALARM_WEBHOOK_URL: "https://hooks.test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      prompts: seedPromptSource(),
      log: () => undefined,
    });
    expect(await check("fine", { position: "rest_chat" })).toMatchObject({
      action: "continue",
      layer: "keyword_alone",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("test_117_m3_without_a_model_the_server_says_once_that_the_classifier_is_off", () => {
    const lines: Record<string, unknown>[] = [];
    serverSafetyCheckFrom({ env: {}, log: (_level, fields) => lines.push(fields) });
    expect(lines).toEqual([{ event: "safety_classifier_off" }]);
  });

  it("test_117_a_failing_provider_logs_an_error_line_without_text_and_raises_the_alarm", async () => {
    const lines: { level: string; fields: Record<string, unknown> }[] = [];
    const posts: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === "https://hooks.test") {
        posts.push(String(url));
        return new Response(null, { status: 204 });
      }
      return new Response("nope", { status: 500 });
    });
    const pending: unknown[] = [];
    const check = serverSafetyCheckFrom({
      env: { ...model, SAFETY_ALARM_WEBHOOK_URL: "https://hooks.test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      prompts: seedPromptSource(),
      counter: null,
      log: (level, fields) => lines.push({ level, fields }),
      schedule: (work) => pending.push(work()),
    });
    const gate = await check("a secret sentence", { position: "rest_chat" });
    await Promise.all(pending);
    expect(gate).toMatchObject({ action: "continue", layer: "keyword_alone" });
    const failed = lines.find((line) => line.fields.event === "safety_classifier_failed");
    expect(failed).toMatchObject({
      level: "error",
      fields: { reason: "request", position: "rest_chat" },
    });
    expect(JSON.stringify(lines)).not.toContain("secret sentence");
    expect(posts).toEqual(["https://hooks.test"]);
  });
});

describe("#117 deploy notes", () => {
  it("test_117_deploy_md_names_the_alarm_and_safety_settings", () => {
    const deploy = readFileSync(path.join(import.meta.dirname, "..", "docs", "deploy.md"), "utf8");
    for (const name of [
      "SAFETY_ALARM_WEBHOOK_URL",
      "SAFETY_MODEL_API_KEY",
      "SAFETY_MODEL_API_URL",
      "SAFETY_MODEL_NAME",
    ]) {
      expect(deploy).toContain(name);
    }
  });
});
