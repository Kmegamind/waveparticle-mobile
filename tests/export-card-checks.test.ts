import { describe, expect, it } from "vitest";
import { readCardExport } from "../scripts/content/import-drafts.mjs";
import { writeInventedCardExport } from "../e2e/support/invented-card-export.mjs";
import { storyPoolProblems, storyPoolWarnings, type PoolCard } from "@/lib/story-cards/pool-checks";
import { seedContent } from "./support/seed-content";

// #516: the admin's card checks (#304, #377, #381: length, dates, spoilers by part, banned words,
// people not in the scene table, repeated lines) on a cards-only export, story by story, in story
// order, as if the new set were published. The switch-over SQL cannot run these TypeScript checks,
// so the owner runs this first, outside the repository's tests:
//
//   CARD_EXPORT="<export folder>" npm run check:export-cards
//
// It prints, per story, how many cards fail and the kinds of problem, with every quoted word
// hidden: card keys and counts only, never a card text. A step card over 4 sentences or 60 words
// is printed as a WARNING (LEN-CARD-WIDE, owner decision 2026-11-28): it never fails the run. Without CARD_EXPORT it checks an INVENTED
// export, so the pull request checks prove that a failing card is reported.

const zeros = () =>
  new Map(seedContent().stories.map((story) => [story.id, story.inputs.stageZero]));

/** Per story: failing card keys and problem kinds (quoted words and numbers hidden). */
export function exportCheckReport(cards: PoolCard[], problems: string[], warnings: string[] = []) {
  const stories = new Map<
    string,
    {
      cards: number;
      failing: Set<string>;
      kinds: Map<string, number>;
      warned: Set<string>;
      warnKinds: Map<string, number>;
    }
  >();
  for (const card of cards) {
    const entry = stories.get(card.story_id) ?? {
      cards: 0,
      failing: new Set(),
      kinds: new Map(),
      warned: new Set(),
      warnKinds: new Map(),
    };
    entry.cards += 1;
    stories.set(card.story_id, entry);
  }
  for (const line of problems) {
    const at = line.indexOf(": ");
    const key = line.slice(0, at);
    const story = stories.get(cards.find((card) => card.key === key)?.story_id ?? "");
    if (!story) continue;
    story.failing.add(key);
    const kind = line
      .slice(at + 2)
      .replace(/"[^"]*"|“[^”]*”/g, '"…"')
      .replace(/\d+/g, "N");
    story.kinds.set(kind, (story.kinds.get(kind) ?? 0) + 1);
  }
  for (const line of warnings) {
    const at = line.indexOf(": ");
    const key = line.slice(0, at);
    const story = stories.get(cards.find((card) => card.key === key)?.story_id ?? "");
    if (!story) continue;
    story.warned.add(key);
    const kind = line.slice(at + 2).replace(/\d+/g, "N");
    story.warnKinds.set(kind, (story.warnKinds.get(kind) ?? 0) + 1);
  }
  return [...stories].map(([story, entry]) => ({
    story,
    cards: entry.cards,
    failing: [...entry.failing].sort(),
    kinds: Object.fromEntries(entry.kinds),
    warned: [...entry.warned].sort(),
    warnKinds: Object.fromEntries(entry.warnKinds),
  }));
}

describe("#516 the card checks on a cards-only export", () => {
  it("test_516_a_failing_card_of_an_export_is_reported_by_key_without_its_text", () => {
    const folder =
      process.env.CARD_EXPORT ??
      writeInventedCardExport({
        stories: [{ id: "bohr-difficulties", cards: [2, 2, 2] }],
        change: (files) => {
          const card = files["app/parts_and_cards.json"].stories[0].cards[1];
          card.body = "It was 1927 in the invented room.";
        },
      });
    const cards = (readCardExport(folder) as { cards: PoolCard[] }).cards;
    const report = exportCheckReport(
      cards,
      storyPoolProblems(cards, zeros()),
      storyPoolWarnings(cards),
    );
    if (process.env.CARD_EXPORT) {
      for (const entry of report) {
        console.log(
          `${entry.story}: ${entry.failing.length} of ${entry.cards} cards fail`,
          JSON.stringify(entry.kinds),
        );
        for (const key of entry.failing) console.log(`  ${key}`);
        if (entry.warned.length > 0) {
          console.log(
            `${entry.story}: WARNING, ${entry.warned.length} cards over the usual length (does not block)`,
            JSON.stringify(entry.warnKinds),
          );
        }
      }
      expect(report.flatMap((entry) => entry.failing)).toEqual([]);
      return;
    }
    expect(report).toHaveLength(1);
    // (The invented cards read alike, so the repeated-lines check may flag others too.)
    expect(report[0].failing).toContain("crd.opp.bohr-difficulties.p1.c1");
    expect(report[0].kinds['Mentions a year ("…"). Years and dates stay in the admin.']).toBe(1);
    expect(JSON.stringify(report)).not.toContain("invented room");
  });

  it("test_523_a_made_ahead_step_card_over_the_length_is_a_warning_and_does_not_fail_the_export", () => {
    const folder = writeInventedCardExport({
      stories: [{ id: "bohr-difficulties", cards: [2, 2, 2] }],
      change: (files) => {
        const card = files["app/parts_and_cards.json"].stories[0].cards[1];
        card.body = `${Array.from({ length: 57 }, (_, i) => `w${i}x`).join(" ")}. Two. Three. Four. Five.`;
      },
    });
    const cards = (readCardExport(folder) as { cards: PoolCard[] }).cards;
    const problems = storyPoolProblems(cards, zeros());
    const report = exportCheckReport(cards, problems, storyPoolWarnings(cards));
    expect(problems.some((line) => / words; | sentences; /.test(line))).toBe(false);
    expect(report[0].warned).toEqual(["crd.opp.bohr-difficulties.p1.c1"]);
    expect(report[0].warnKinds).toEqual({
      "N words; the usual limit is N.": 1,
      "N sentences; the usual limit is N.": 1,
    });
  });
});
