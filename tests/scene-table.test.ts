import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import decks from "@/content/oppenheimer/story-decks.json";
import { parseStoryContent } from "@/lib/content/parse";
import { companionPeople, sceneCheckOf, sceneTableOf, unseenPeople } from "@/lib/content/scene";
import { createModelGateway, type ModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { pauseMessageFor } from "@/lib/prototype/rest-lines";
import { storyDetail, type StoryCardRow } from "@/lib/story-cards/admin";
import { cardProblems, SCENE_UNREADABLE } from "@/lib/story-cards/checks";
import { seedContent, seedDocument } from "./support/seed-content";
import { seedPromptSource, seedRows } from "./support/seed-prompts";

// #64 (US-CON-4) and #65 (US-CON-7): each Story's one scene table (SCENE-PER-STORY), loaded from
// the imported data, checked on every card, and passed to the pause message and its checks.

const root = path.join(import.meta.dirname, "..");
const seed = seedContent();
const stageZeroFile = (id: string) =>
  JSON.parse(readFileSync(path.join(root, "docs", "demo", `${id}.stage0.json`), "utf8")) as {
    scene: Record<string, unknown>;
    slices: { id: string }[];
  };
const zeros = new Map(seed.stories.map((story) => [story.id, story.inputs.stageZero]));
const people = companionPeople(zeros.values());
const trinity = seed.stories.find((story) => story.id === "trinity")!;
const trinityScene = sceneCheckOf(trinity.inputs.stageZero, people);

const part = (body: string) => ({ kind: "part" as const, part: 1, body });

describe("#64 AC1 and #65 AC1: every Story has one scene table, loaded into the code", () => {
  it("test_64_ac1_each_story_has_its_scene_table_as_drafted", () => {
    expect(seed.stories).toHaveLength(26);
    for (const story of seed.stories) {
      const drafted = stageZeroFile(story.id).scene;
      expect(story.inputs.scene, story.id).toEqual({
        present: drafted.present,
        allowedWords: drafted.allowedWords,
        props: drafted.props,
        pauseProp: drafted.pauseProp,
        laterWords: drafted.laterWords,
      });
    }
  });

  it("test_65_ac1_the_data_gives_props_names_and_one_pause_prop", () => {
    for (const story of seed.stories) {
      const scene = story.inputs.scene!;
      expect(scene.props.length, story.id).toBeGreaterThan(0);
      expect(scene.allowedWords.length, story.id).toBeGreaterThan(0);
      expect(scene.props, story.id).toContain(scene.pauseProp);
      for (const name of scene.present) expect(scene.allowedWords, story.id).toContain(name);
    }
  });

  it("test_64_ac1_no_weather_or_light_scales", () => {
    for (const story of seed.stories) {
      expect(Object.keys(story.inputs.scene!).sort()).toEqual(
        ["allowedWords", "laterWords", "pauseProp", "present", "props"].sort(),
      );
    }
  });

  it("test_64_ac1_a_missing_or_broken_scene_table_reads_as_none", () => {
    expect(sceneTableOf({})).toBeNull();
    expect(sceneTableOf({ scene: { present: [], props: ["cup"], pauseProp: "cup" } })).toBeNull();
    expect(
      sceneTableOf({
        scene: {
          present: [],
          allowedWords: ["Bohr"],
          props: ["cup"],
          pauseProp: 7,
          laterWords: [],
        },
      }),
    ).toBeNull();
    type Inputs = { inputs: { stage_zero: Record<string, unknown> } };
    const broken = structuredClone(seedDocument());
    delete (broken.stories[0] as Inputs).inputs.stage_zero.scene;
    const story = parseStoryContent(broken).stories[0];
    expect(story.inputs.scene).toBeNull();
  });
});

describe("#64 AC2: a card that names a person not in its Story's scene fails the card check", () => {
  it("test_64_ac2_a_person_outside_the_scene_fails", () => {
    expect(cardProblems(part("I think of Strauss and his letter."), [], trinityScene)).toEqual([
      'Names "Strauss", who is not in this story\'s scene table.',
    ]);
  });

  it("test_64_ac2_a_person_in_the_scene_passes", () => {
    expect(cardProblems(part("Fermi is taking bets by the long table."), [], trinityScene)).toEqual(
      [],
    );
  });

  it("test_64_ac2_a_titled_person_outside_the_scene_fails", () => {
    expect(
      cardProblems(part("Doctor Whitlow is waiting by the door."), [], trinityScene),
    ).toContain('Names "Doctor Whitlow", who is not in this story\'s scene table.');
  });

  it("test_64_ac2_the_background_card_is_checked_too", () => {
    const background = { kind: "background" as const, part: null, body: "Truman is here." };
    expect(cardProblems(background, [], trinityScene)).toEqual([
      'Names "Truman", who is not in this story\'s scene table.',
    ]);
  });

  it("test_64_ac2_no_scene_table_blocks_the_card", () => {
    expect(cardProblems(part("I keep my notes flat."), [], null)).toEqual([SCENE_UNREADABLE]);
  });

  it("test_64_ac2_unseen_people_reads_names_on_word_boundaries", () => {
    const scene = { allowed: ["Kitty"], people: ["Kitty", "May", "de Silva"] };
    expect(unseenPeople("Kitty and I talk.", scene)).toEqual([]);
    expect(unseenPeople("I mayhaps wait.", scene)).toEqual([]);
    expect(unseenPeople("I spoke to de Silva.", scene)).toEqual(["de Silva"]);
  });

  it("test_64_ac2_the_admin_marks_such_a_card_as_failing", () => {
    const row: StoryCardRow = {
      key: "crd.opp.trinity.p1.c1",
      version: 1,
      story_id: "trinity",
      kind: "part",
      part: 1,
      slice: "s1",
      position: 1,
      body: "Strauss keeps his coat on.",
      published: true,
      published_at: "2026-11-20T00:00:00Z",
    };
    const detail = storyDetail(
      { id: "trinity", title: "Trinity", sequence: 13 },
      [],
      [row],
      () => [],
      trinityScene,
    );
    expect(detail!.parts[0].cards[0].problems).toContain(
      'Names "Strauss", who is not in this story\'s scene table.',
    );
  });

  it("test_64_ac2_every_seed_card_carries_a_state_tag_and_passes_the_scene_check", () => {
    for (const [id, deck] of Object.entries(decks)) {
      if (id === "story1") continue; // not a real story; the import skips it
      const story = seed.stories.find((item) => item.id === id)!;
      const slices = stageZeroFile(id).slices.map((slice) => slice.id);
      const scene = sceneCheckOf(story.inputs.stageZero, people);
      expect(unseenPeople(deck.background, scene!), `${id} background`).toEqual([]);
      for (const deckPart of deck.parts) {
        for (const card of deckPart.cards) {
          expect(slices, `${id} ${card.at}`).toContain(card.at);
          expect(unseenPeople(card.text, scene!), `${id} ${card.at}`).toEqual([]);
        }
      }
    }
  });
});

describe("#64 AC3 and #65 AC1: the scene table is an input to the pause message and its checks", () => {
  function fakeGateway() {
    const call = vi.fn(async () => ({ source: "generated", text: "My pencil is blunt." }));
    return { gateway: { writeStuckStory: call } as unknown as ModelGateway, call };
  }

  it("test_64_ac3_the_pause_message_gets_the_story_scene", async () => {
    const { gateway, call } = fakeGateway();
    await pauseMessageFor(seed, { storyId: "trinity", pauseNumber: 1 }, gateway);
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: {
          present: trinity.inputs.scene!.present,
          allowedWords: trinity.inputs.scene!.allowedWords,
          props: trinity.inputs.scene!.props,
          pauseProp: "coffee cup",
          laterWords: trinity.inputs.scene!.laterWords,
        },
      }),
    );
  });

  function provider(replies: string[]): { calls: string[]; impl: ModelProvider } {
    const calls: string[] = [];
    return {
      calls,
      impl: async ({ prompt }) => {
        calls.push(prompt);
        return replies.shift() ?? "";
      },
    };
  }

  const scene = {
    present: ["Kitty"],
    allowedWords: ["Kitty", "Haakon"],
    props: ["martini glass", "shaker"],
    pauseProp: "shaker",
    laterWords: ["Mesa"],
  };

  it("test_64_ac3_the_stuck_story_prompt_names_the_prop_the_objects_and_the_people", async () => {
    const fake = provider([JSON.stringify({ story: "The shaker lid sticks in my hand." })]);
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
    await gateway.writeStuckStory({ pauseNumber: 1, facts: "He is at home.", scene });
    expect(fake.calls[0]).toContain("shaker");
    expect(fake.calls[0]).toContain("martini glass, shaker");
    expect(fake.calls[0]).toContain("Kitty");
    expect(fake.calls[0]).toContain("Haakon");
  });

  it("test_65_ac1_a_stuck_story_that_adds_a_person_is_generated_again", async () => {
    const fake = provider([
      JSON.stringify({ story: "I wait while Strauss reads my letter." }),
      JSON.stringify({ story: "The shaker lid sticks in my hand." }),
    ]);
    const known = ["Strauss", "Kitty", "Haakon"];
    const logs: { rejectedRules: string[] }[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
      log: (event) => logs.push(event as { rejectedRules: string[] }),
    });
    const result = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "f",
      scene,
      people: known,
    });
    expect(result).toEqual({ source: "generated", text: "The shaker lid sticks in my hand." });
    expect(fake.calls).toHaveLength(2);
    expect(logs.at(-1)?.rejectedRules).toContain("people");
  });

  it("test_65_ac1_a_stuck_story_with_a_later_word_is_generated_again", async () => {
    const fake = provider([
      // Fix round 1 (C1): a capitalised later word matches only with its capitals.
      JSON.stringify({ story: "I keep thinking about the Mesa while the shaker sticks." }),
      JSON.stringify({ story: "The shaker lid sticks in my hand." }),
    ]);
    const logs: { rejectedRules: string[] }[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
      log: (event) => logs.push(event as { rejectedRules: string[] }),
    });
    const result = await gateway.writeStuckStory({ pauseNumber: 1, facts: "f", scene });
    expect(result.source).toBe("generated");
    expect(logs.at(-1)?.rejectedRules).toContain("leak");
  });

  it("test_65_ac1_the_retry_hint_names_the_people_rule", () => {
    const hints = seedRows().find((row) => row.key === "retry_hints")!;
    expect((hints.params.fixes as Record<string, string>).people).toMatch(/people/i);
  });

  it("test_65_ac4_no_quiet_lines_are_written", () => {
    const stuck = seedRows().find((row) => row.key === "stuck_story")!;
    expect(JSON.stringify(stuck).toLowerCase()).not.toContain("quiet");
  });
});

// Fix round 1 of #374 (review C1, I2, I4, M6).
describe("#65 AC1 the scene checks on the live pause message, without false alarms", () => {
  const sceneOf = (id: string) => seed.stories.find((story) => story.id === id)!.inputs.scene!;
  const known = people;

  function gatewayWith(lines: string[]) {
    const calls: string[] = [];
    const logs: { rejectedRules: string[] }[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: async ({ prompt }) => {
        calls.push(prompt);
        return JSON.stringify({ story: lines.shift() ?? "My pencil is blunt." });
      },
      log: (event) => logs.push(event as { rejectedRules: string[] }),
    });
    return { gateway, calls, logs };
  }

  async function firstTry(id: string, line: string) {
    const { gateway, calls, logs } = gatewayWith([line]);
    const result = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "f",
      scene: sceneOf(id),
      people: known,
    });
    return { result, calls, logs };
  }

  it("test_65_ac1_c1_common_words_are_not_later_words", async () => {
    const cases: [string, string][] = [
      ["oval-office", "I am worried I may fail."],
      ["fermi-award", "This time my notes are out of order."],
      ["fermi-award", "Sometimes my pen runs dry."],
      ["groves-berkeley", "A new snag holds up my notes."],
      ["trinity", "I have lost my place in the notes."],
      ["site-search", "My boot lace is coming loose, so I stop close by."],
      ["truchas-morning", "My hat is lost in the wind."],
    ];
    for (const [id, line] of cases) {
      const { result, calls } = await firstTry(id, line);
      expect(result, `${id}: ${line}`).toEqual({ source: "generated", text: line });
      expect(calls, `${id}: ${line}`).toHaveLength(1);
    }
  });

  it("test_65_ac1_c1_a_true_later_word_is_still_a_leak", async () => {
    const { result, calls, logs } = await firstTry(
      "trinity",
      "I think of Los Alamos and my notes.",
    );
    expect(result.source).toBe("generated");
    expect(calls.length).toBeGreaterThan(1);
    expect(logs.at(-1)?.rejectedRules).toContain("leak");
  });

  it("test_65_ac1_c1_a_lower_case_later_word_matches_in_any_case", async () => {
    const { laterWordHits } = await import("@/lib/content/scene");
    expect(laterWordHits("The Kapitza Club meets.", ["kapitza club"])).toEqual(["kapitza club"]);
    expect(laterWordHits("I may fail.", ["May"])).toEqual([]);
    expect(laterWordHits("I will see New York.", ["New York"])).toEqual(["New York"]);
  });

  it("test_65_ac1_i2_a_known_person_at_the_start_of_a_sentence_fails", async () => {
    for (const line of ["Strauss reads my letter.", "I wait. Dr. Strauss reads my letter."]) {
      const { calls, logs } = await firstTry("trinity", line);
      expect(calls.length, line).toBeGreaterThan(1);
      expect(logs.at(-1)?.rejectedRules, line).toContain("people");
    }
  });

  it("test_65_ac1_i4_an_unknown_capitalised_word_that_is_no_known_person_passes", async () => {
    for (const line of [
      "On Monday my notes are wet.",
      "My Army boots pinch.",
      "God knows my pencil is blunt.",
    ]) {
      const { result, calls } = await firstTry("bohr-difficulties", line);
      expect(result, line).toEqual({ source: "generated", text: line });
      expect(calls, line).toHaveLength(1);
    }
  });

  it("test_65_ac1_m6_the_version_1_prompt_row_still_works_with_a_scene", async () => {
    const v2 = seedRows().find((row) => row.key === "stuck_story")!;
    const v1 = {
      ...v2,
      version: 1,
      body: v2.body
        .split("\n")
        .filter((line) => !/\{\{(pauseProp|props|present|allowedWords)\}\}/.test(line))
        .join("\n"),
    };
    const rows = seedRows().map((row) => (row.key === "stuck_story" ? v1 : row));
    const gateway = createModelGateway({
      prompts: async (key) => rows.find((row) => row.key === key) ?? null,
      provider: async () => JSON.stringify({ story: "My pencil is blunt." }),
    });
    const result = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "f",
      scene: sceneOf("trinity"),
      people: known,
    });
    expect(result).toEqual({ source: "generated", text: "My pencil is blunt." });
  });
});
