import { describe, expect, it, vi } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { checkCompanionLine, cleanLine, ownNameWords } from "@/lib/model-gateway/checks";
import { generationInputs } from "@/lib/prototype/story-inputs";
import { seedContent } from "./support/seed-content";
import { seedPromptSource } from "./support/seed-prompts";

// #302 AC6: the `name` check rejects a line that names the Companion speaking it, taken from that
// Companion's name, not from a fixed Oppenheimer pattern.

const limits = { max_words: 45, max_sentences: 3 };
const check = (line: string, name: string) =>
  checkCompanionLine(line, "step_card", [], limits, name);
const rules = (result: ReturnType<typeof check>) => (result.ok ? [] : result.rejectedRules);

describe("#302 AC6 the name check follows the Companion", () => {
  it("test_302_ac6_name_words_skip_initials_and_titles", () => {
    expect(ownNameWords("J. Robert Oppenheimer")).toEqual(["robert", "oppenheimer"]);
    expect(ownNameWords("Professor Moriarty")).toEqual(["moriarty"]);
    expect(ownNameWords("Count Dracula")).toEqual(["dracula"]);
  });

  it("test_302_ac6_oppenheimer_lines_are_checked_as_before", () => {
    // #468: the name is passed explicitly; there is no default Companion.
    const name = "J. Robert Oppenheimer";
    expect(rules(check("I signed it Robert and posted it.", name))).toContain("name");
    expect(rules(check("I told them Oppenheimer was tired.", name))).toContain("name");
    expect(check("I posted the letter to Born.", name).ok).toBe(true);
    expect(cleanLine("Oppenheimer: I posted it.", name)).toBe("I posted it.");
  });

  it("test_302_ac6_another_companion_is_checked_against_his_own_name", () => {
    expect(rules(check("I signed it Moriarty and burned it.", "Professor Moriarty"))).toContain(
      "name",
    );
    // Oppenheimer's name is not Moriarty's: it is a story fact for him, not his own name.
    expect(check("I read a note about Oppenheimer.", "Professor Moriarty").ok).toBe(true);
    expect(cleanLine("Moriarty: I burned it.", "Professor Moriarty")).toBe("I burned it.");
  });

  it("test_302_ac6_the_gateway_uses_the_name_in_the_input", async () => {
    const answer = JSON.stringify({ story: "I signed it Moriarty and burned it." });
    const impl: ModelProvider = async () => answer;
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: impl,
      maxAttempts: 1,
    });
    const moriarty = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "FACT.",
      companionName: "Professor Moriarty",
    });
    expect(moriarty).toEqual({ source: "failed", reason: "checks" });
    const oppenheimer = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "FACT.",
      companionName: "J. Robert Oppenheimer",
    });
    expect(oppenheimer.source).toBe("generated");
  });

  it("test_302_ac6_generation_inputs_carry_the_stories_companion_name", () => {
    expect(generationInputs(seedContent(), "site-search").companionName).toBe(
      "J. Robert Oppenheimer",
    );
  });
});

// #468, AI-CHARACTER-NEUTRAL (2026-11-26): no check holds one character's name. A check run
// without the name of the Companion speaking fails loudly; it never falls back to Oppenheimer.
describe("#468 the name check has no default Companion", () => {
  const untyped = checkCompanionLine as (...args: unknown[]) => ReturnType<typeof check>;

  it("test_468_a_check_without_a_name_does_not_use_oppenheimer", () => {
    for (const name of [undefined, "", "  "]) {
      for (const line of ["I told them Oppenheimer was tired.", "I posted the letter to Born."]) {
        expect(() => untyped(line, "step_card", [], limits, name)).toThrow(/Companion name/);
      }
    }
  });

  it("test_468_checks_exports_no_default_companion_name", async () => {
    const checks: Record<string, unknown> = await import("@/lib/model-gateway/checks");
    expect(checks.DEFAULT_COMPANION_NAME).toBeUndefined();
    expect(Object.values(checks)).not.toContain("J. Robert Oppenheimer");
  });

  it("test_468_a_gateway_call_without_a_name_fails_with_a_logged_reason", async () => {
    const provider = vi.fn<ModelProvider>(async () =>
      JSON.stringify({ story: "Oppenheimer posted the letter. He waited." }),
    );
    const logs: { rejectedRules: string[] }[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider,
      maxAttempts: 1,
      log: (entry) => logs.push(entry),
    });
    const input = { pauseNumber: 1, facts: "FACT." } as Parameters<
      typeof gateway.writeStuckStory
    >[0];
    expect(await gateway.writeStuckStory(input)).toEqual({ source: "failed", reason: "prompt" });
    expect(provider).not.toHaveBeenCalled();
    expect(logs.at(-1)?.rejectedRules).toEqual(["companion_name"]);
  });

  it("test_468_the_server_log_names_the_missing_companion_name", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>();
    const gateway = createServerModelGateway({
      prompts: seedPromptSource(),
      env: { MODEL_API_KEY: "k", MODEL_API_URL: "https://models.example/v1", MODEL_NAME: "m" },
      maxAttempts: 1,
      fetchImpl,
    });
    const input = { facts: "FACT.", userMessage: "hello" } as Parameters<
      typeof gateway.writeRestReply
    >[0];
    expect((await gateway.writeRestReply(input)).source).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({
      event: "model_call_failed",
      call: "rest_reply",
      rejectedRules: ["companion_name"],
    });
    error.mockRestore();
  });
});
