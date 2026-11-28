import { describe, expect, it } from "vitest";
import { readCardExport } from "../scripts/content/import-drafts.mjs";
import {
  newCardText,
  newLeakWord,
  writeInventedCardExport,
} from "../e2e/support/invented-card-export.mjs";
import { storyPoolProblems, type PoolCard } from "@/lib/story-cards/pool-checks";
import { withWaitingStageZeros } from "@/lib/story-cards/reader";
import { seedContent } from "./support/seed-content";

// #516: the admin's card checks (#304, #377, #381: length, dates, spoilers by part, banned words,
// people not in the scene table, repeated lines) on a cards-only export, story by story, in story
// order, as if the new set were published. The switch-over SQL cannot run these TypeScript checks,
// so the owner runs this first, outside the repository's tests:
//
//   CARD_EXPORT="<export folder>" npm run check:export-cards
//
// It prints, per story, how many cards fail and the kinds of problem, with every quoted word
// hidden: card keys and counts only, never a card text. Without CARD_EXPORT it checks an INVENTED
// export, so the pull request checks prove that a failing card is reported.
// #526: when the export has a stage 0 folder, each story is checked with the export's new slices,
// steps and scene (as after its switch-over), not with the stage 0 the phones read now.

type ExportRows = { cards: PoolCard[]; stageZeros?: { story_id: string; stage: object }[] };

/** The seed stage 0 of every story, with the export's new slices, steps and scene in place. */
const zeros = (rows?: ExportRows) =>
  withWaitingStageZeros(
    new Map(seedContent().stories.map((story) => [story.id, story.inputs.stageZero])),
    Object.fromEntries((rows?.stageZeros ?? []).map((entry) => [entry.story_id, entry.stage])),
  );

/** Per story: failing card keys and problem kinds (quoted words and numbers hidden). */
export function exportCheckReport(cards: PoolCard[], problems: string[]) {
  const stories = new Map<
    string,
    { cards: number; failing: Set<string>; kinds: Map<string, number> }
  >();
  for (const card of cards) {
    const entry = stories.get(card.story_id) ?? { cards: 0, failing: new Set(), kinds: new Map() };
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
  return [...stories].map(([story, entry]) => ({
    story,
    cards: entry.cards,
    failing: [...entry.failing].sort(),
    kinds: Object.fromEntries(entry.kinds),
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
    const rows = readCardExport(folder) as ExportRows;
    const cards = rows.cards;
    const report = exportCheckReport(cards, storyPoolProblems(cards, zeros(rows)));
    if (process.env.CARD_EXPORT) {
      for (const entry of report) {
        console.log(
          `${entry.story}: ${entry.failing.length} of ${entry.cards} cards fail`,
          JSON.stringify(entry.kinds),
        );
        for (const key of entry.failing) console.log(`  ${key}`);
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
});

describe("#526 the pre-switch check reads the export's new stage 0", () => {
  const story = { id: "bohr-difficulties", cards: [2, 2, 2] };
  // A part 1 card names the spoiler word of the new stage 0's part 2 slice.
  const leaking: Parameters<typeof writeInventedCardExport>[0]["change"] = (files) => {
    const card = files["app/parts_and_cards.json"].stories[0].cards[1];
    card.body = `${newCardText(story.id, 1, 1)} ${newLeakWord(story.id, 2)} waits.`;
  };
  const laterPartProblems = (stageZero: boolean) => {
    const rows = readCardExport(
      writeInventedCardExport({ stories: [story], stageZero, change: leaking }),
    ) as ExportRows;
    return storyPoolProblems(rows.cards, zeros(rows)).filter((line) => line.includes("later part"));
  };

  it("test_526_ac3_a_card_naming_a_later_slice_of_the_new_stage_0_is_reported", () => {
    expect(laterPartProblems(true)).toEqual([
      expect.stringMatching(/^crd\.opp\.bohr-difficulties\.p1\.c1: /),
    ]);
  });

  it("test_526_ac3_without_the_export_stage_0_the_old_one_is_used_and_misses_it", () => {
    expect(laterPartProblems(false)).toEqual([]);
  });

  it("test_526_ac3_the_new_stage_0_replaces_only_slices_steps_and_scene", () => {
    const rows = readCardExport(
      writeInventedCardExport({ stories: [story], stageZero: true }),
    ) as ExportRows;
    const seed = seedContent().stories.find((entry) => entry.id === story.id)!.inputs.stageZero;
    const merged = zeros(rows).get(story.id)!;
    const stage = rows.stageZeros![0].stage as Record<string, unknown>;
    for (const key of ["slices", "steps", "scene"]) expect(merged[key]).toEqual(stage[key]);
    for (const key of Object.keys(seed).filter((k) => !["slices", "steps", "scene"].includes(k)))
      expect(merged[key]).toEqual(seed[key]);
    // The display texts of the file are never read.
    expect(JSON.stringify(rows.stageZeros)).not.toContain("Invented export who line");
  });
});
