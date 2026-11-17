import { describe, expect, it } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { checkCompanionLine, cleanLine, ownNameWords } from "@/lib/model-gateway/checks";
import { generationInputs } from "@/lib/prototype/story-inputs";
import { seedContent } from "./support/seed-content";
import { seedPromptSource } from "./support/seed-prompts";

// #302 AC6: the `name` check rejects a line that names the Companion speaking it, taken from that
// Companion's name, not from a fixed Oppenheimer pattern.

const limits = { max_words: 45, max_sentences: 3 };
const check = (line: string, name?: string) =>
  checkCompanionLine(line, "step_card", [], limits, name);
const rules = (result: ReturnType<typeof check>) => (result.ok ? [] : result.rejectedRules);

describe("#302 AC6 the name check follows the Companion", () => {
  it("test_302_ac6_name_words_skip_initials_and_titles", () => {
    expect(ownNameWords("J. Robert Oppenheimer")).toEqual(["robert", "oppenheimer"]);
    expect(ownNameWords("Professor Moriarty")).toEqual(["moriarty"]);
    expect(ownNameWords("Count Dracula")).toEqual(["dracula"]);
  });

  it("test_302_ac6_oppenheimer_lines_are_checked_as_before", () => {
    for (const name of [undefined, "J. Robert Oppenheimer"]) {
      expect(rules(check("I signed it Robert and posted it.", name))).toContain("name");
      expect(rules(check("I told them Oppenheimer was tired.", name))).toContain("name");
      expect(check("I posted the letter to Born.", name).ok).toBe(true);
      expect(cleanLine("Oppenheimer: I posted it.", name)).toBe("I posted it.");
    }
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
    const oppenheimer = await gateway.writeStuckStory({ pauseNumber: 1, facts: "FACT." });
    expect(oppenheimer.source).toBe("generated");
  });

  it("test_302_ac6_generation_inputs_carry_the_stories_companion_name", () => {
    expect(generationInputs(seedContent(), "site-search").companionName).toBe(
      "J. Robert Oppenheimer",
    );
  });
});
