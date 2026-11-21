import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway } from "@/lib/model-gateway";
import { checkCompanionLine } from "@/lib/model-gateway/checks";
import type { CompanionKind } from "@/lib/model-gateway/types";
import { cardProblems } from "@/lib/story-cards/checks";
import { seedLineLimits, seedPromptSource } from "./support/seed-prompts";

// #55 (US-SAF-9): the output guard on every AI reply is the shared checks, including the style
// checks. There is no word list of dangerous method or instruction words (NO-DENYLIST,
// 2026-11-21). SAFETY-PREMADE still holds for pre-made content.

const root = path.join(import.meta.dirname, "..");

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

const KINDS: CompanionKind[] = [
  "step_card",
  "background_card",
  "stuck_story",
  "rest_reply",
  "return_popup",
  "closing_line",
];

describe("#55 output guard", () => {
  it("test_55_ac1_every_reply_kind_passes_the_shared_checks_including_the_style_checks", () => {
    const good = "I keep my notes flat on the table.";
    for (const kind of KINDS) {
      const check = (text: string) => checkCompanionLine(text, kind, [], seedLineLimits(kind));
      expect(check(good).ok, kind).toBe(true);
      // Style checks: a dash, an exclamation mark, a banned word.
      expect(check("I keep my notes flat — on the table."), kind).toMatchObject({ ok: false });
      expect(check("I keep my notes flat on the table!"), kind).toMatchObject({ ok: false });
      expect(check("I keep my notes flat, no cap."), kind).toMatchObject({ ok: false });
    }
  });

  it("test_55_ac1_no_word_list_of_method_or_instruction_words_in_code", () => {
    for (const file of filesUnder(path.join(root, "src"))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/deny\s*-?list|block\s*-?list/i);
      expect(text, file).not.toMatch(/(method|instruction)[_ ]?words/i);
    }
  });

  it("test_55_ac2_a_failing_reply_is_generated_again_then_fails_with_no_stored_text", async () => {
    const rejected = "I keep my notes flat — on the table.";
    let calls = 0;
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: async () => {
        calls += 1;
        return JSON.stringify({ reply: rejected });
      },
    });
    const reply = await gateway.writeRestReply({ userMessage: "Hello.", facts: "A quiet room." });
    expect(calls).toBeGreaterThan(1);
    expect(reply).toEqual({ source: "failed", reason: "checks" });
    expect(JSON.stringify(reply)).not.toContain(rejected);
  });

  it("test_55_ac3_safety_premade_the_banned_words_of_the_shared_checks_block_a_premade_card", () => {
    const card = { kind: "part" as const, part: 1, body: "The room had good vibes that night." };
    expect(cardProblems(card, [])).toContain('Uses a banned word ("vibes").');
  });
});
