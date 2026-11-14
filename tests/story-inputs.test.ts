import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { oppenheimerStories } from "@/content/oppenheimer";
import type { ModelGateway } from "@/lib/model-gateway";
import { cardsForStep, normaliseStepCardsRequest } from "@/lib/prototype/focus-cards";
import { pauseMessageFor, restReplyFor, returnLineFor } from "@/lib/prototype/rest-lines";
import { syncSession } from "@/lib/prototype/session";
import { DEFAULT_STORY_ID, pickStory } from "@/lib/prototype/story-ids";
import {
  STORY_IDS,
  generationInputs,
  rawStoryInputs,
  storyProfile,
  storyProfiles,
  validateStoryInputs,
} from "@/lib/prototype/story-inputs";

// Issue #254: every Oppenheimer story on the test path generates from its own inputs.

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const storyOf = (id: string) => oppenheimerStories.find((story) => story.id === id)!;

function recordingGateway(
  result: unknown = { source: "generated", cards: ["I set the lamp down."] },
) {
  const writeStepCards = vi.fn(async () => result);
  const writeStuckStory = vi.fn(async () => ({ source: "generated", text: "I am held up." }));
  return {
    gateway: { writeStepCards, writeStuckStory } as unknown as ModelGateway,
    writeStepCards,
    writeStuckStory,
  };
}

/** Every stored line inside an input file: authored cards, example lines and people's lines. */
function storedLines(id: string): string[] {
  const raw = rawStoryInputs(id) as Record<string, unknown>;
  const lines: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string") lines.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(raw.authoredCards);
  // His example lines; a chat example's "user" field is a sample of the user's words, not his.
  for (const [kind, value] of Object.entries((raw.examples ?? {}) as Record<string, unknown>)) {
    if (kind === "chat" && Array.isArray(value)) {
      for (const turn of value) collect((turn as { reply?: unknown }).reply);
    } else collect(value);
  }
  for (const person of Object.values(
    (raw.people ?? {}) as Record<string, Record<string, unknown>>,
  )) {
    collect(person.line);
    collect(person.first_card);
  }
  // A line equal to one of the story's input fields (the goal sentence, Who I am, the opening
  // place) is an input the page may show (AC3), not a stored card.
  const story = raw.story as Record<string, unknown>;
  const where = raw.whereNow as Record<string, unknown>;
  const inputs = new Set([raw.who, story.goalShort, where.s1].map((value) => String(value).trim()));
  return lines.filter((line) => line.trim().split(/\s+/).length >= 4 && !inputs.has(line.trim()));
}

describe("#254 AC2 every story's input file is valid", () => {
  it("has the 26 stories of stories.json, in their order", () => {
    expect(STORY_IDS).toEqual(oppenheimerStories.map((story) => story.id));
    expect(STORY_IDS).toHaveLength(26);
  });

  it.each(STORY_IDS)("%s: required fields, facts for every step, forbidden terms", (id) => {
    expect(validateStoryInputs(id, rawStoryInputs(id), storyOf(id))).toEqual([]);
  });

  it("names the story and the problem when a file is broken", () => {
    const broken = JSON.parse(JSON.stringify(rawStoryInputs("bohr-difficulties")));
    delete broken.who;
    broken.story.forbidTerms = [];
    broken.steps[0].covers = ["no-such-slice"];
    broken._note = "";
    const problems = validateStoryInputs("bohr-difficulties", broken, storyOf("bohr-difficulties"));
    expect(problems).toEqual(
      expect.arrayContaining([
        "bohr-difficulties: who is missing",
        "bohr-difficulties: story.forbidTerms is empty",
        "bohr-difficulties: step 1 has no facts",
        "bohr-difficulties: _note (the AI-drafted, unreviewed note) is missing",
      ]),
    );
  });
});

describe("#254 AC1 each story generates only from its own inputs", () => {
  it.each(STORY_IDS)("%s: the generation inputs are that file's who, place and goal", (id) => {
    const raw = rawStoryInputs(id) as { who: string; story: Record<string, unknown> };
    expect(generationInputs(id)).toMatchObject({
      who: raw.who,
      place: raw.story.place,
      goalShort: raw.story.goalShort,
    });
    expect(generationInputs(id).forbidTerms).toEqual(
      expect.arrayContaining([
        ...storyOf(id).forbiddenTerms,
        ...(raw.story.forbidTerms as string[]),
      ]),
    );
  });

  it("the cards for bohr-difficulties use its own facts and nothing from site-search", async () => {
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(
      { storyId: "bohr-difficulties", index: 0, planMinutes: [20, 20], earlierCards: [] },
      gateway,
    );
    const input = (writeStepCards.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    const sent = JSON.stringify(input);
    expect(sent).toContain(generationInputs("bohr-difficulties").who);
    expect(sent).toContain(storyOf("bohr-difficulties").facts[0].text);
    expect(sent).not.toContain("Jemez");
    expect(sent).not.toContain(generationInputs("site-search").who);
    expect(input.forbidTerms).toEqual(generationInputs("bohr-difficulties").forbidTerms);
  });

  it("his pause message for a story uses that story's inputs", async () => {
    const { gateway, writeStuckStory } = recordingGateway();
    await pauseMessageFor({ storyId: "trinity", pauseNumber: 1, lastCard: "" }, gateway);
    const sent = JSON.stringify(writeStuckStory.mock.calls);
    expect(sent).toContain(generationInputs("trinity").who);
    expect(sent).not.toContain(generationInputs("site-search").who);
  });

  it("no card or line source imports the chapter 8 file directly", () => {
    for (const file of ["src/lib/prototype/focus-cards.ts", "src/lib/prototype/rest-lines.ts"]) {
      expect(read(file), file).not.toMatch(/site-search\.(generated|stage0)\.json/);
    }
  });
});

describe("#254 AC3 a chapter starts from its own opening, goal sentence and Who I am", () => {
  it.each(STORY_IDS)("%s", (id) => {
    const raw = rawStoryInputs(id) as {
      who: string;
      whereNow: { s1: string };
      story: { title: string; goalShort: string };
    };
    const profile = storyProfile(id);
    expect(profile).toEqual({
      id,
      title: storyOf(id).title,
      goalShort: raw.story.goalShort,
      who: raw.who,
      opening: `${raw.whereNow.s1} What are you working on?`,
    });
    // The goal opener's existing rule (CONTENT_MODEL 7.2): two sentences, 30 words, the question last.
    expect(profile.opening.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(profile.opening.match(/\?/g)).toHaveLength(1);
    expect(profile.opening.endsWith("?")).toBe(true);
  });
});

describe("#254 AC4 no stored card text reaches the page when a model is configured", () => {
  it.each(STORY_IDS)("%s: profiles and generation inputs hold no stored line", (id) => {
    const reaching = JSON.stringify([storyProfile(id), generationInputs(id), storyProfiles()]);
    for (const line of storedLines(id)) expect(reaching, line).not.toContain(line);
  });

  it.each(STORY_IDS)("%s: a failed generation is a failure, never a stored card", async (id) => {
    const { gateway } = recordingGateway({ source: "failed", reason: "checks" });
    expect(
      await cardsForStep({ storyId: id, index: 0, planMinutes: [20], earlierCards: [] }, gateway),
    ).toEqual({ status: "failed" });
  });

  it("with a model, the page gets exactly the generated cards, not the demo cache", async () => {
    const cache = JSON.parse(read("docs/demo/bohr-difficulties.generated.json")) as {
      steps: { cards: { text: string }[] }[];
    };
    const { gateway } = recordingGateway({
      source: "generated",
      cards: ["I set the lamp down.", "I turn the ink jar."],
    });
    const result = await cardsForStep(
      { storyId: "bohr-difficulties", index: 0, planMinutes: [20], earlierCards: [] },
      gateway,
    );
    expect(result).toEqual({
      status: "ok",
      isTestData: false,
      cards: { opening: "I set the lamp down.", story: ["I turn the ink jar."] },
    });
    const shown = JSON.stringify(result);
    for (const step of cache.steps)
      for (const card of step.cards) expect(shown).not.toContain(card.text);
  });
});

describe("#254 AC5 the request keeps its story", () => {
  it("keeps a known story, refuses an unknown one, and reads an old request as chapter 8", () => {
    expect(
      normaliseStepCardsRequest({
        storyId: "trinity",
        index: 0,
        planMinutes: [10],
        earlierCards: [],
      }),
    ).toMatchObject({ storyId: "trinity" });
    expect(
      normaliseStepCardsRequest({ storyId: "nope", index: 0, planMinutes: [10], earlierCards: [] }),
    ).toBeNull();
    expect(
      normaliseStepCardsRequest({ index: 0, planMinutes: [10], earlierCards: [] }),
    ).toMatchObject({
      storyId: "site-search",
    });
  });
});

describe("#254 AC7 the AI-drafted note stays in every file", () => {
  it.each(STORY_IDS)("%s", (id) => {
    const note = (rawStoryInputs(id) as { _note?: string })._note ?? "";
    expect(note).toMatch(/DRAFT|draft/);
  });
});

describe("#254 review: the story never switches", () => {
  it("an unknown story fails his pause, rest and return lines instead of using chapter 8", async () => {
    const { gateway, writeStuckStory } = recordingGateway();
    const writeRestReply = vi.fn();
    const writeReturnPopup = vi.fn();
    Object.assign(gateway, { writeRestReply, writeReturnPopup });
    expect(await pauseMessageFor({ storyId: "nope", pauseNumber: 1 }, gateway)).toEqual({
      status: "failed",
    });
    expect(
      await restReplyFor(
        { storyId: "nope", message: "hello", history: [], replyIndex: 0 },
        gateway,
      ),
    ).toEqual({ status: "failed" });
    expect(
      await returnLineFor({ storyId: "nope", trigger: "rest", awayMinutes: 3 }, gateway),
    ).toEqual({ status: "failed" });
    expect(writeStuckStory).not.toHaveBeenCalled();
    expect(writeRestReply).not.toHaveBeenCalled();
    expect(writeReturnPopup).not.toHaveBeenCalled();
  });

  it("the focus session of one story is never reused for another with the same Plan", () => {
    const plan = {
      goal: { text: "Read the paper", minutes: 20 },
      steps: [{ title: "Read", description: "", minutes: 20 }],
    };
    const chapter8 = syncSession(null, { ...plan, storyId: "site-search" }, 1);
    expect(syncSession(chapter8, { ...plan, storyId: "site-search" }, 1)).toBe(chapter8);
    expect(syncSession(chapter8, { ...plan, storyId: "bohr-difficulties" }, 1)).not.toBe(chapter8);
  });

  it("every screen picks the story the same way: the chosen one, else chapter 8", () => {
    const stories = storyProfiles();
    expect(pickStory(stories, "trinity").id).toBe("trinity");
    expect(pickStory(stories, undefined).id).toBe(DEFAULT_STORY_ID);
    expect(pickStory(stories, "nope").id).toBe(DEFAULT_STORY_ID);
    for (const file of [
      "src/app/try/try-home.tsx",
      "src/app/try/focus/focus-screen.tsx",
      "src/app/try/goal/goal-dialogue.tsx",
    ]) {
      expect(read(file), file).toContain("pickStory(");
      expect(read(file), file).not.toContain('"site-search"');
    }
  });
});
