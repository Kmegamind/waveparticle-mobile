import { describe, expect, it } from "vitest";
import { createModelGateway, promptRowProblems } from "@/lib/model-gateway";
import type { PromptKey, PromptRow } from "@/lib/prompts/repository";
import { seedRows } from "./support/seed-prompts";

// #308 AC7: a prompt version the gateway would refuse cannot be published. The check is the
// gateway's own row check, run over every branch of the key's builder.

const seed = (key: PromptKey): PromptRow =>
  structuredClone(seedRows().find((row) => row.key === key)!);

/** Settings as plain nested objects, so a test can delete or change one. */
type Settings = Record<string, Record<string, unknown>>;

function withParams(key: PromptKey, change: (params: Settings) => void): PromptRow {
  const row = seed(key);
  change(row.params as Settings);
  return row;
}

describe("promptRowProblems (#308 AC7)", () => {
  it("test_308_ac7_every_seed_prompt_passes", () => {
    const rows = seedRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(promptRowProblems(row), row.key).toEqual([]);
  });

  it("test_308_ac7_an_unknown_placeholder_is_named", () => {
    const row = seed("rest_reply");
    row.body = row.body.replace("{{facts}}", "{{fatcs}}");
    expect(promptRowProblems(row)).toContain("Unknown {{fatcs}} in the prompt.");
  });

  it("test_308_ac7_every_unknown_placeholder_is_listed", () => {
    const row = seed("closing_line");
    row.body = `${row.body}\nOne {{a1}} and {{b2}}.\nAgain {{a1}}.`;
    const problems = promptRowProblems(row);
    expect(problems.filter((p) => p === "Unknown {{a1}} in the prompt.")).toHaveLength(1);
    expect(problems).toContain("Unknown {{b2}} in the prompt.");
  });

  it("test_308_ac7_a_missing_line_limit_is_named", () => {
    const rest = withParams("rest_reply", (params) => delete params.checks.max_words);
    expect(promptRowProblems(rest)).toContain("Missing or unusable setting: checks.");
    const stuck = withParams(
      "stuck_story",
      (params) => delete (params as Record<string, unknown>).checks,
    );
    expect(promptRowProblems(stuck)).toContain("Missing or unusable setting: checks.");
  });

  it("test_308_ac7_a_setting_used_in_only_one_branch_is_checked", () => {
    const cases: [PromptKey, string][] = [
      ["stuck_story", "situation_harder"],
      ["return_popup", "situation_absence"],
      ["step_cards", "nothing_new"],
      ["plan_split", "split_finer_yes"],
    ];
    for (const [key, name] of cases) {
      const row = withParams(key, (params) => delete params.text[name]);
      expect(promptRowProblems(row), key).toContain(`Missing or unusable setting: text.${name}.`);
    }
  });

  it("test_308_ac7_step_cards_checks_are_named", () => {
    const noBackground = withParams("step_cards", (params) => delete params.checks.background_card);
    expect(promptRowProblems(noBackground)).toContain(
      "Missing or unusable setting: checks.background_card.",
    );
    const textCount = withParams("step_cards", (params) => (params.checks.max_story_cards = "3"));
    expect(promptRowProblems(textCount)).toContain(
      "Missing or unusable setting: checks.max_story_cards.",
    );
  });

  it("test_308_ac7_an_unknown_placeholder_inside_a_text_setting_is_named", () => {
    const row = withParams(
      "step_cards",
      (params) => (params.text.cards_counted = "Write {{storyCrads}} cards."),
    );
    expect(promptRowProblems(row)).toContain("Unknown {{storyCrads}} in text.cards_counted.");
  });

  it("test_308_ac7_retry_hints_is_rendered_with_fixes", () => {
    const row = seed("retry_hints");
    row.body = `${row.body}\n{{fix}}`;
    expect(promptRowProblems(row)).toContain("Unknown {{fix}} in the prompt.");
  });

  it("test_308_the_live_call_still_fails_with_reason_prompt", async () => {
    const broken = seed("rest_reply");
    broken.body = broken.body.replace("{{facts}}", "{{fatcs}}");
    const rows = seedRows().map((row) => (row.key === "rest_reply" ? broken : row));
    let calls = 0;
    const gateway = createModelGateway({
      prompts: async (key) => rows.find((row) => row.key === key) ?? null,
      provider: async () => {
        calls += 1;
        return '{"reply":"I wait."}';
      },
    });
    const result = await gateway.writeRestReply({ facts: "f", userMessage: "u" });
    expect(result).toEqual({ source: "failed", reason: "prompt" });
    expect(calls).toBe(0);
  });
});
