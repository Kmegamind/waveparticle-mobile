import type { ModelGateway, ModelProvider } from "@/lib/model-gateway/types";

/**
 * Inputs that exercise every branch of every gateway prompt (#282). The golden file
 * `tests/fixtures/gateway-prompts.json` holds the prompts the gateway built for them before the
 * prompts moved to the database; the gateway must keep building exactly these strings. The pause
 * cases were recorded again for the two-call pause (#56, `stuck_story` version 3,
 * `pause_predicament` version 1), and the plan split cases for the owner's planning prompt (#40,
 * `plan_split` version 2); every other case is unchanged.
 *
 * Each call is answered three times: invalid JSON (a "parse" retry), an answer that fails several
 * checks (a retry with several fixes), then nothing usable, so every prompt and both retry prompts
 * are recorded.
 */

const notJson = "no json here";
const badLine = "You should look — later! What now?";

type Case = { name: string; answers: string[]; call: (gateway: ModelGateway) => Promise<unknown> };

const facts = "He is at the mesa with Dudley. The canyon is ahead.";

export const GATEWAY_PROMPT_CASES: Case[] = [
  {
    name: "plan split, keep it broad",
    answers: [notJson, JSON.stringify({ title: "", steps: [] }), notJson],
    call: (g) =>
      g.splitPlan({ goal: "Write the methods section", totalMinutes: 60, splitFiner: false }),
  },
  {
    name: "plan split, finer, user text with braces",
    answers: [notJson, notJson, notJson],
    call: (g) =>
      g.splitPlan({
        goal: "Fix {{facts}} and {{goal}} in my notes",
        totalMinutes: 25,
        splitFiner: true,
      }),
  },
  {
    name: "step cards, plain",
    answers: [notJson, JSON.stringify({ cards: [badLine] }), notJson],
    call: (g) => g.writeStepCards({ minutes: 20, facts }),
  },
  {
    name: "step cards, background, numbered, must-use, new facts",
    answers: [notJson, notJson, notJson],
    call: (g) =>
      g.writeStepCards({
        minutes: 15,
        facts,
        stepFacts: "A truck breaks down on the road.",
        stepNumber: 1,
        stepCount: 4,
        storyCards: 3,
        background: true,
        mustUse: ["He sees the school.", "Dudley shrugs."],
      }),
  },
  {
    name: "step cards, nothing new, story count too high",
    answers: [notJson, notJson, notJson],
    call: (g) =>
      g.writeStepCards({
        minutes: 10,
        facts,
        stepFacts: "  ",
        stepNumber: 3,
        stepCount: 4,
        storyCards: 9,
      }),
  },
  {
    name: "step cards, story count not a number of cards",
    answers: [notJson, notJson, notJson],
    call: (g) => g.writeStepCards({ minutes: 10, facts, storyCards: 0, stepNumber: 2 }),
  },
  {
    name: "stuck story, first pause",
    answers: [notJson, JSON.stringify({ story: badLine }), notJson],
    call: (g) => g.writeStuckStory({ pauseNumber: 1, facts }),
  },
  {
    name: "stuck story, third pause",
    answers: [notJson, notJson, notJson],
    call: (g) => g.writeStuckStory({ pauseNumber: 3, facts }),
  },
  {
    name: "stuck story, invalid pause number",
    answers: [notJson, notJson, notJson],
    call: (g) => g.writeStuckStory({ pauseNumber: 2.5, facts }),
  },
  {
    name: "stuck story, chosen category and prop, scene and earlier snags (#56)",
    answers: [notJson, JSON.stringify({ prop: "lamp", story: badLine }), notJson],
    call: (g) =>
      g.writeStuckStory({
        pauseNumber: 2,
        facts,
        category: "paper",
        prop: "notebook",
        earlierStories: ["His pencil has gone blunt."],
        scene: {
          present: ["Dudley"],
          allowedWords: ["Dudley", "Jemez"],
          props: ["notebook", "pencil", "lamp"],
          pauseProp: "pencil",
          laterWords: [],
        },
      }),
  },
  {
    name: "pause predicament, first pause (#56)",
    answers: [notJson, badLine, notJson],
    call: (g) =>
      g.writePausePredicament({ pauseNumber: 1, facts, story: "His pencil has gone blunt." }),
  },
  {
    name: "pause predicament, third pause, earlier snags (#56)",
    answers: [notJson, notJson, notJson],
    call: (g) =>
      g.writePausePredicament({
        pauseNumber: 3,
        facts,
        story: "The notebook page has curled.",
        earlierStories: ["His pencil has gone blunt.", "The lamp smokes."],
      }),
  },
  {
    name: "rest reply, user text with braces",
    answers: [notJson, JSON.stringify({ reply: badLine }), notJson],
    call: (g) => g.writeRestReply({ facts, userMessage: "I am stuck on {{facts}} again." }),
  },
  {
    name: "return pop-up after rest",
    answers: [notJson, JSON.stringify({ returnLine: badLine }), notJson],
    call: (g) => g.writeReturnPopup({ trigger: "rest", facts, awayMinutes: 3 }),
  },
  {
    name: "return pop-up after an absence",
    answers: [notJson, notJson, notJson],
    call: (g) => g.writeReturnPopup({ trigger: "absence", facts, awayMinutes: 42 }),
  },
  {
    name: "closing line",
    answers: [notJson, JSON.stringify({ closing_line: badLine, carry_line: badLine }), notJson],
    call: (g) => g.writeClosingLine({ facts, lastMoment: "He signs the letter." }),
  },
];

/** Runs every case and returns the prompts the provider received, per case name. */
export async function recordGatewayPrompts(
  createGateway: (provider: ModelProvider) => ModelGateway,
): Promise<Record<string, string[]>> {
  const recorded: Record<string, string[]> = {};
  for (const item of GATEWAY_PROMPT_CASES) {
    const prompts: string[] = [];
    const gateway = createGateway(async ({ prompt }) => {
      prompts.push(prompt);
      return item.answers[prompts.length - 1] ?? notJson;
    });
    await item.call(gateway);
    recorded[item.name] = prompts;
  }
  return recorded;
}
