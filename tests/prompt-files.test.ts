import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROMPT_KEYS,
  parsePromptFile,
  readPromptDirectory,
  writePromptFile,
} from "../scripts/prompts/prompt-files.mjs";

const seedDirectory = path.join(import.meta.dirname, "..", "docs", "ai", "prompts");

const sample = {
  key: "rest_reply",
  version: 2,
  note: "Shorter facts line",
  params: { checks: { max_words: 80 } },
  body: 'Return JSON only: {"reply":"..."}\nThe person wrote: {{userMessage}}',
};

describe("prompt files (#282)", () => {
  it("test_282_a_prompt_file_round_trips", () => {
    const text = writePromptFile(sample);
    expect(text).toContain("# Prompt: rest_reply");
    expect(parsePromptFile(text)).toEqual(sample);
    expect(writePromptFile(parsePromptFile(text))).toBe(text);
  });

  it("test_282_a_file_without_its_blocks_is_rejected", () => {
    expect(() => parsePromptFile("# Prompt: x\n\nno blocks")).toThrow(/settings block/);
  });

  it("test_282_the_seed_has_exactly_the_gateway_keys", () => {
    expect(readPromptDirectory(seedDirectory).map((row: { key: string }) => row.key)).toEqual(
      [...PROMPT_KEYS].sort(),
    );
  });

  it("test_282_every_seed_file_is_already_in_the_written_form", () => {
    for (const key of PROMPT_KEYS) {
      const text = readFileSync(path.join(seedDirectory, `${key}.md`), "utf8");
      expect(writePromptFile(parsePromptFile(text)), key).toBe(text);
      expect(parsePromptFile(text).key).toBe(key);
    }
  });
});
