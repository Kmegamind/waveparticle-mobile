import { describe, expect, it, vi } from "vitest";
import { oppenheimerStories } from "@/content/oppenheimer";
import { createModelGateway, type ModelGateway } from "@/lib/model-gateway";
import { checkCompanionLine } from "@/lib/model-gateway/checks";
import type { ModelProvider } from "@/lib/model-gateway";
import {
  cardsForStep,
  normaliseStepCardsRequest,
  type StepCardsRequest,
} from "@/lib/prototype/focus-cards";
import { maxStoryCards } from "@/lib/prototype/session";
import { startStory } from "@/lib/story/start";
import { seedPromptSource, seedLineLimits } from "./support/seed-prompts";
import type { CompanionKind } from "@/lib/model-gateway/types";

// #282: the length limits are data in the prompt rows; tests use the seed's.
const checkLine = (text: string, kind: CompanionKind, forbidTerms: string[] = []) =>
  checkCompanionLine(text, kind, forbidTerms, seedLineLimits(kind));

// #43 US-AI-2 (criteria corrected 2026-11-13) and #216.

const siteSearch = oppenheimerStories.find((story) => story.id === "site-search")!;
const words = (count: number, word = "dust") =>
  `I ${Array.from({ length: count - 1 }, () => word).join(" ")}.`;

function recordingProvider(answers: string[]) {
  const prompts: string[] = [];
  const impl: ModelProvider = async ({ prompt }) => {
    prompts.push(prompt);
    return answers.shift() ?? "";
  };
  return { prompts, impl };
}

function recordingGateway() {
  const writeStepCards = vi.fn(async () => ({
    source: "generated" as const,
    cards: ["I look at the canyon.", "My boots are wet."],
  }));
  return { gateway: { writeStepCards } as unknown as ModelGateway, writeStepCards };
}

const request = (overrides: Partial<StepCardsRequest> = {}): StepCardsRequest => ({
  index: 1,
  planMinutes: [20, 25, 15],
  earlierCards: [],
  ...overrides,
});

describe("#216 the step-cards prompt holds no user-written text", () => {
  it("the request has no Step title: a title sent anyway never reaches the gateway", async () => {
    const normal = normaliseStepCardsRequest({
      ...request(),
      stepTitle: "Write the methods section of my lab report",
      goal: "Finish my thesis",
    });
    expect(normal).not.toBeNull();
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(normal!, gateway);
    const sent = JSON.stringify(writeStepCards.mock.calls);
    expect(sent).not.toContain("Write the methods section");
    expect(sent).not.toContain("Finish my thesis");
  });

  it("the gateway prompt has no Step line", async () => {
    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 20,
      facts: "I am at Jemez Springs.",
    });
    expect(fake.prompts[0]).not.toMatch(/^Step:/m);
  });
});

describe("#43 AC1 the Story is divided across the Plan's Steps", () => {
  it("sends this Step's facts and must-use key lines, never a later Step's facts", async () => {
    const plan = [20, 25, 15];
    const brief = startStory(
      siteSearch,
      plan.map((minutes) => ({ minutes })),
    );
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(request({ index: 1, planMinutes: plan }), gateway);
    const input = (writeStepCards.mock.calls[0] as unknown as [Record<string, unknown>])[0];

    const text = (id: string) => siteSearch.facts.find((fact) => fact.id === id)!.text;
    for (const id of brief.steps[1].factIds) expect(input.stepFacts).toContain(text(id));
    for (const id of brief.steps[2].factIds) {
      expect(input.facts).not.toContain(text(id));
      expect(input.stepFacts).not.toContain(text(id));
    }
    const mustUse = brief.steps[1].mustUseKeySliceIds.map(
      (id) => siteSearch.keySlices.find((slice) => slice.id === id)!.keyLine,
    );
    expect(input.mustUse).toEqual(mustUse);
    expect(input).toMatchObject({
      stepNumber: 2,
      stepCount: 3,
      minutes: 25,
      storyCards: maxStoryCards(25),
      background: false,
    });
    expect(input.forbidTerms).toEqual(expect.arrayContaining(siteSearch.forbiddenTerms));
  });

  it("asks for the background card as the first card of Step 1", async () => {
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(request({ index: 0 }), gateway);
    expect(writeStepCards).toHaveBeenCalledWith(expect.objectContaining({ background: true }));
  });

  it("the prompt states the Step's place in the Story and the number of cards", async () => {
    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 25,
      facts: "I am at Jemez Springs.",
      stepNumber: 2,
      stepCount: 3,
      storyCards: 3,
      mustUse: ["I told Groves about the mesa."],
    });
    expect(fake.prompts[0]).toContain("Step 2 of 3");
    expect(fake.prompts[0]).toContain("1 opening card and then 3 story cards");
    expect(fake.prompts[0]).toContain("I told Groves about the mesa.");
  });

  it("keeps the opening card and at most the Step's story cards", async () => {
    const cards = [
      "I see the mesa.",
      "My map is wet.",
      "My driver frowns at the road.",
      "Mud dries on my boots.",
    ];
    const fake = recordingProvider([JSON.stringify({ cards })]);
    const result = await createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
    }).writeStepCards({
      minutes: 10,
      facts: "I am at Jemez Springs.",
      storyCards: 2,
    });
    expect(result).toEqual({ source: "generated", cards: cards.slice(0, 3) });
  });
});

describe("#43 AC2 CARD-LENGTH", () => {
  it("a story card is one to three sentences and at most 45 words", () => {
    expect(checkLine(words(45), "step_card").ok).toBe(true);
    expect(checkLine("I wait. My map is wet. I fold it.", "step_card").ok).toBe(true);
    const long = checkLine(words(46), "step_card");
    expect(long).toEqual({ ok: false, rejectedRules: ["len"] });
    const four = checkLine("I wait. My map is wet. I fold it. I stand.", "step_card");
    expect(four).toEqual({ ok: false, rejectedRules: ["len"] });
  });

  it("the background card is at most 70 words, with no sentence limit", () => {
    expect(checkLine(words(70), "background_card").ok).toBe(true);
    const five = "I am here. My map is wet. I fold it. I stand. I look at the mesa.";
    expect(checkLine(five, "background_card").ok).toBe(true);
    expect(checkLine(words(71), "background_card")).toEqual({
      ok: false,
      rejectedRules: ["len"],
    });
  });

  it("the gateway checks the first card as the background card when asked", async () => {
    const background = words(60);
    const answer = JSON.stringify({ cards: [background, "My map is wet."] });
    const asBackground = await createModelGateway({
      prompts: seedPromptSource(),
      provider: recordingProvider([answer]).impl,
    }).writeStepCards({ minutes: 20, facts: "f", background: true });
    expect(asBackground).toEqual({ source: "generated", cards: [background, "My map is wet."] });

    const asCard = await createModelGateway({
      prompts: seedPromptSource(),
      provider: recordingProvider([answer, answer, answer]).impl,
    }).writeStepCards({ minutes: 20, facts: "f" });
    expect(asCard).toEqual({ source: "failed", reason: "checks" });
  });

  it("the prompt carries the limits", async () => {
    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 20,
      facts: "f",
      background: true,
    });
    expect(fake.prompts[0]).toContain("1 to 3 sentences and at most 45 words");
    expect(fake.prompts[0]).toContain("at most 70 words");
  });
});

describe("#43 AC2 CARD-NEW every card says something new", () => {
  it("the page's earlier cards reach the gateway as the run's earlier lines", async () => {
    const { gateway, writeStepCards } = recordingGateway();
    const earlierCards = ["I drove out to Jemez Springs.", "The canyon walls close in."];
    await cardsForStep(request({ earlierCards }), gateway);
    expect(writeStepCards).toHaveBeenCalledWith(
      expect.objectContaining({ earlierLines: earlierCards }),
    );
  });

  it("a card that repeats an earlier card is generated again", async () => {
    const repeat = JSON.stringify({ cards: ["I drove out to Jemez Springs."] });
    const fresh = JSON.stringify({ cards: ["My boots sink in the wet sand."] });
    const fake = recordingProvider([repeat, fresh]);
    const result = await createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
    }).writeStepCards({
      minutes: 20,
      facts: "f",
      earlierLines: ["I drove out to Jemez Springs."],
    });
    expect(result).toEqual({ source: "generated", cards: ["My boots sink in the wet sand."] });
    expect(fake.prompts).toHaveLength(2);
  });
});

describe("#43 AC3 generated again within the time limit, then the failure message", () => {
  it("returns an explicit failure and no text when every attempt fails the checks", async () => {
    const bad = JSON.stringify({ cards: [words(80)] });
    const fake = recordingProvider([bad, bad, bad]);
    const result = await createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
    }).writeStepCards({
      minutes: 20,
      facts: "f",
    });
    expect(result).toEqual({ source: "failed", reason: "checks" });
    expect(fake.prompts).toHaveLength(3);
    const { gateway } = {
      gateway: { writeStepCards: async () => result } as unknown as ModelGateway,
    };
    expect(await cardsForStep(request(), gateway)).toEqual({ status: "failed" });
  });
});

describe("#43 the request from the page is checked (it is a public endpoint)", () => {
  it("keeps numbers and earlier cards within limits and drops everything else", () => {
    expect(normaliseStepCardsRequest(null)).toBeNull();
    expect(
      normaliseStepCardsRequest({ index: 3, planMinutes: [10, 10], earlierCards: [] }),
    ).toBeNull();
    expect(normaliseStepCardsRequest({ index: 0, planMinutes: [], earlierCards: [] })).toBeNull();
    expect(normaliseStepCardsRequest({ index: 0, planMinutes: [0], earlierCards: [] })).toBeNull();
    expect(
      normaliseStepCardsRequest({ index: 0, planMinutes: Array(51).fill(10), earlierCards: [] }),
    ).toBeNull();
    const many = normaliseStepCardsRequest({
      index: 0,
      planMinutes: [10],
      earlierCards: [...Array(80).fill("I wait."), 5, "x".repeat(601)],
    });
    expect(many).toEqual({
      storyId: "site-search",
      index: 0,
      planMinutes: [10],
      earlierCards: Array(60).fill("I wait."),
    });
  });
});

describe("#43 review: the prompt marks what is new in this Step (CARD-NEW)", () => {
  it("sends this Step's facts apart from the facts of earlier Steps", async () => {
    const plan = [20, 25, 15];
    const brief = startStory(
      siteSearch,
      plan.map((minutes) => ({ minutes })),
    );
    const text = (id: string) => siteSearch.facts.find((fact) => fact.id === id)!.text;
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(request({ index: 1, planMinutes: plan }), gateway);
    const input = (writeStepCards.mock.calls[0] as unknown as [Record<string, string>])[0];
    for (const id of brief.steps[1].factIds) expect(input.stepFacts).toContain(text(id));
    for (const id of brief.steps[0].factIds) {
      expect(input.stepFacts).not.toContain(text(id));
      expect(input.facts).toContain(text(id));
    }
  });

  it("the prompt labels earlier facts and this part's facts", async () => {
    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 20,
      facts: "I drove to Jemez Springs.",
      stepFacts: "Groves listens to me about the mesa.",
    });
    expect(fake.prompts[0]).toContain("Already happened: I drove to Jemez Springs.");
    expect(fake.prompts[0]).toContain("New in this part: Groves listens to me about the mesa.");
    expect(fake.prompts[0]).not.toContain("Facts already known");
  });

  it("a Step with no facts of its own is told that nothing new happens", async () => {
    const plan = Array.from({ length: 14 }, () => 5);
    const { gateway, writeStepCards } = recordingGateway();
    await cardsForStep(request({ index: 13, planMinutes: plan }), gateway);
    const input = (writeStepCards.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(input.stepFacts).toBe("");

    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 5,
      facts: "I drove to Jemez Springs.",
      stepFacts: "",
    });
    expect(fake.prompts[0]).toContain(
      "Nothing new happens in this part: he stays in the moment he is in, with no new events.",
    );
  });

  it("the word limit of 45 is for story cards, so the background card keeps its 70", async () => {
    const fake = recordingProvider([JSON.stringify({ cards: ["I look at the canyon."] })]);
    await createModelGateway({ prompts: seedPromptSource(), provider: fake.impl }).writeStepCards({
      minutes: 20,
      facts: "f",
      background: true,
    });
    expect(fake.prompts[0]).toContain("Each story card is 1 to 3 sentences");
  });
});
