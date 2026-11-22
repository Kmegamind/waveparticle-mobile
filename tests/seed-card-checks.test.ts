import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readStoryDecks, storyCardRows } from "../scripts/story-cards/import.mjs";
import { companionPeople, sceneCheckOf, sceneTableOf, unseenPeople } from "@/lib/content/scene";
import { cardProblems, SCENE_UNREADABLE } from "@/lib/story-cards/checks";
import { storyPoolProblems, type PoolCard } from "@/lib/story-cards/pool-checks";
import { seedContent } from "./support/seed-content";

// #46 (US-CON-12): the automatic card checks run on the whole seed pool (src/content/<companion>/
// story-decks.json) in the pull request checks, and a failing seed card fails them. There is no
// human review gate (PUBLISH-FIRST).

const root = path.join(import.meta.dirname, "..");
const zeros = new Map(seedContent().stories.map((story) => [story.id, story.inputs.stageZero]));
const seedCards = () => (storyCardRows(readStoryDecks()) as { cards: PoolCard[] }).cards;

describe("#46 the card checks on the whole seed pool", () => {
  it("test_46_ac1_ac4_every_seed_card_passes_the_card_checks", () => {
    expect(storyPoolProblems(seedCards(), zeros)).toEqual([]);
  });

  it("test_46_ac1_a_failing_seed_card_is_reported_with_its_key", () => {
    const cards = seedCards();
    const card = cards.find((row) => row.kind === "part")!;
    card.body = "It was 1943 and the room was cold.";
    const problems = storyPoolProblems(cards, zeros);
    expect(problems).toContainEqual(expect.stringContaining(`${card.key}: Mentions a year`));
  });

  it("test_46_ac1_repeated_lines_in_a_story_are_reported", () => {
    const cards = seedCards();
    const own = cards.filter((row) => row.story_id === "bohr-difficulties");
    own[2].body = own[1].body;
    const problems = storyPoolProblems(cards, zeros);
    expect(problems).toContain(`${own[2].key}: Repeats an earlier card of this story.`);
  });

  it("test_46_ac1_a_word_from_a_later_part_is_reported", () => {
    const cards = seedCards();
    const background = cards.find((row) => row.story_id === "bohr-difficulties")!;
    background.body = "I keep thinking of Kapitza and his club.";
    expect(storyPoolProblems(cards, zeros).join("\n")).toMatch(/comes in a later part/);
  });

  // #381 (finishes #46 AC3): the seed-file check also runs the scene person check (#374).
  it("test_381_ac1_a_seed_card_naming_an_absent_person_fails_with_key_and_person", () => {
    const cards = seedCards();
    const card = cards.find((row) => row.story_id === "trinity" && row.kind === "part")!;
    const scene = sceneCheckOf(zeros.get("trinity"), companionPeople(zeros.values()))!;
    const absent = scene.people.find((name) => unseenPeople(name, scene).length > 0)!;
    card.body = `${absent} stood by the door.`;
    expect(storyPoolProblems(cards, zeros)).toContain(
      `${card.key}: Names "${absent}", who is not in this story's scene table.`,
    );
  });

  it("test_381_ac3_a_scene_that_passes_leaves_the_result_unchanged", () => {
    const cards = seedCards();
    const card = cards.find((row) => row.story_id === "trinity" && row.kind === "part")!;
    const present = sceneTableOf(zeros.get("trinity"))!.present[0];
    card.body = `${present} stood by the door.`;
    expect(storyPoolProblems(cards, zeros).filter((line) => /scene table/.test(line))).toEqual([]);
  });

  it("test_381_ac1_a_story_without_a_scene_table_blocks_its_cards", () => {
    const problems = storyPoolProblems(seedCards(), new Map());
    expect(problems.some((line) => line.includes(SCENE_UNREADABLE))).toBe(true);
  });

  it("test_381_ac2_the_admin_intro_names_the_scene_check", () => {
    const page = readFileSync(
      path.join(root, "src", "app", "admin", "stories", "[id]", "page.tsx"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(page).toContain(
      "words from later parts, people who are not in the scene table and banned words",
    );
  });

  it("test_46_ac1_a_story_without_inputs_blocks_its_cards", () => {
    const problems = storyPoolProblems(seedCards(), new Map());
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/spoiler check could not run/);
  });

  it("test_46_ac5_the_checks_cover_every_story_of_the_pool", () => {
    const stories = new Set(seedCards().map((row) => row.story_id));
    expect(stories.size).toBe(26);
  });

  it("test_46_ac1_the_pull_request_checks_run_the_seed_card_checks", () => {
    const ci = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).toMatch(/name: Seed card checks\s+run: npm run check:cards/);
    const scripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts;
    expect(scripts["check:cards"]).toBe("vitest run tests/seed-card-checks.test.ts");
  });

  // Owner decision of 2026-11-21 on #375: the pointer-word check also reads quoted speech; only the
  // introduction check ignores quotes (QUOTED-DIALOGUE, #365).
  it("test_46_ac4_a_pointer_word_inside_quoted_speech_still_fails", () => {
    const part = (body: string) => ({ kind: "part" as const, part: 1, body });
    expect(cardProblems(part("I said, “We will try again.” Nobody moved."), [])).toHaveLength(1);
    expect(cardProblems(part("I will try again. Nobody moved."), [])).toHaveLength(1);
  });
});
