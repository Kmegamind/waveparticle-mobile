import { describe, expect, it, vi } from "vitest";
import { PAUSE_CATEGORIES } from "@/lib/content/pause-snag";
import type { ModelGateway } from "@/lib/model-gateway";
import { normalisePauseRequest } from "@/lib/prototype/line-requests";
import { pauseMessageFor } from "@/lib/prototype/rest-lines";
import {
  addPauseMessage,
  pauseHistory,
  startRest,
  backFromRest,
  type FocusSession,
} from "@/lib/prototype/session";
import { seedContent } from "./support/seed-content";

// #56 (US-AI-3): the pause message on the rest page is made with two calls; the code picks the
// category and the prop from the earlier Pauses; the moment never moves his Story. Refs #65.

const seed = seedContent();
const trinity = seed.stories.find((story) => story.id === "trinity")!;
const trinityScene = trinity.inputs.scene!;

function twoCalls(options: { first?: unknown; second?: unknown } = {}) {
  const stuck = vi.fn(async (input: { prop?: string }) =>
    options.first !== undefined
      ? options.first
      : { source: "generated", prop: input.prop, story: `His ${input.prop} gets in the way.` },
  );
  const predicament = vi.fn(async () =>
    options.second !== undefined
      ? options.second
      : { source: "generated", text: "I cannot get on, and it makes me restless." },
  );
  const gateway = {
    writeStuckStory: stuck,
    writePausePredicament: predicament,
  } as unknown as ModelGateway;
  return { gateway, stuck, predicament };
}

function session(): FocusSession {
  return {
    version: 1,
    planKey: "k",
    speed: 1,
    current: 0,
    steps: [
      {
        cards: { opening: "I sit at the table.", story: ["I read my notes."] },
        clock: null,
        shownStory: 1,
        targetSeconds: 600,
      },
      { cards: null, clock: null, shownStory: 0, targetSeconds: 600 },
    ],
    holdUntilMs: null,
    undo: null,
    paused: false,
    pausedAtMs: null,
    pauses: [0, 0],
    rest: null,
    returnPending: null,
    returnLine: null,
  };
}

describe("#56 AC1 two calls: the stuck story, then his words about it", () => {
  it("test_56_ac1_call_one_gets_the_code_choice_and_call_two_gets_its_story", async () => {
    const { gateway, stuck, predicament } = twoCalls();
    const result = await pauseMessageFor(seed, { storyId: "trinity", pauseNumber: 1 }, gateway);
    expect(stuck).toHaveBeenCalledWith(
      expect.objectContaining({
        pauseNumber: 1,
        category: PAUSE_CATEGORIES[0],
        prop: trinityScene.pauseProp,
        scene: trinityScene,
      }),
    );
    expect(predicament).toHaveBeenCalledWith(
      expect.objectContaining({
        pauseNumber: 1,
        story: `His ${trinityScene.pauseProp} gets in the way.`,
      }),
    );
    expect(result).toEqual({
      status: "ok",
      isTestData: false,
      text: "I cannot get on, and it makes me restless.",
      story: `His ${trinityScene.pauseProp} gets in the way.`,
      category: PAUSE_CATEGORIES[0],
      prop: trinityScene.pauseProp,
    });
  });

  it("test_56_ac1_the_object_check_gets_every_prop_of_the_companion", async () => {
    const { gateway, stuck } = twoCalls();
    await pauseMessageFor(seed, { storyId: "trinity", pauseNumber: 1 }, gateway);
    const input = stuck.mock.calls[0][0] as { companionProps: string[] };
    const all = seed.stories.flatMap((story) => story.inputs.scene?.props ?? []);
    expect(new Set(input.companionProps)).toEqual(new Set(all));
  });
});

describe("#56 AC2 the code picks from the earlier Pauses", () => {
  it("test_56_ac2_the_request_history_decides_the_category_and_the_prop", async () => {
    const { gateway, stuck } = twoCalls();
    await pauseMessageFor(
      seed,
      {
        storyId: "trinity",
        pauseNumber: 2,
        recentCategories: ["body", "gear"],
        usedProps: [trinityScene.pauseProp],
      },
      gateway,
    );
    const input = stuck.mock.calls[0][0] as { category: string; prop: string };
    expect(["body", "gear"]).not.toContain(input.category);
    expect(input.prop).not.toBe(trinityScene.pauseProp);
    expect(trinityScene.props).toContain(input.prop);
  });

  it("test_56_ac2_three_pauses_through_the_session_use_new_categories_and_props", async () => {
    let current = session();
    const categories: string[] = [];
    const props: string[] = [];
    for (let pause = 1; pause <= 3; pause += 1) {
      current = startRest(current, 1_000 * pause);
      const { gateway, stuck } = twoCalls();
      const result = await pauseMessageFor(
        seed,
        { storyId: "trinity", pauseNumber: current.rest!.pauseNumber, ...pauseHistory(current) },
        gateway,
      );
      if (result.status !== "ok") throw new Error("failed");
      const input = stuck.mock.calls[0][0] as { earlierStories: string[] };
      expect(input.earlierStories).toHaveLength(pause - 1);
      categories.push(result.category!);
      props.push(result.prop!);
      current = backFromRest(addPauseMessage(current, result));
    }
    expect(new Set(categories).size).toBe(3);
    expect(new Set(props).size).toBe(3);
  });

  it("test_56_ac2_the_request_from_the_browser_is_kept_in_bounds", () => {
    const request = normalisePauseRequest({
      pauseNumber: 2,
      recentCategories: ["body", 7, "gear", "sound"],
      usedProps: Array.from({ length: 80 }, (_, index) => `prop ${index}`),
      earlierStories: ["x".repeat(5_000)],
      earlierLines: "not a list",
    });
    expect(request.recentCategories).toEqual(["gear", "sound"]);
    expect(request.usedProps).toHaveLength(50);
    expect(request.earlierStories[0]).toHaveLength(1_000);
    expect(request.earlierLines).toEqual([]);
  });
});

describe("#56 AC4 a failed call is the failure screen, never a stored line", () => {
  it("test_56_ac4_a_failed_call_one_fails_the_pause_and_call_two_is_not_made", async () => {
    const { gateway, predicament } = twoCalls({ first: { source: "failed", reason: "checks" } });
    expect(await pauseMessageFor(seed, { storyId: "trinity", pauseNumber: 1 }, gateway)).toEqual({
      status: "failed",
    });
    expect(predicament).not.toHaveBeenCalled();
  });

  it("test_56_ac4_a_failed_call_two_fails_the_pause_with_no_text", async () => {
    const { gateway } = twoCalls({ second: { source: "failed", reason: "timeout" } });
    expect(await pauseMessageFor(seed, { storyId: "trinity", pauseNumber: 1 }, gateway)).toEqual({
      status: "failed",
    });
  });
});

describe("#56 AC5 and #65: the moment never moves his Story", () => {
  it("test_56_ac5_adding_the_pause_message_changes_no_step_card_or_clock", () => {
    const paused = startRest(session(), 5_000);
    const after = addPauseMessage(paused, {
      text: "I cannot get on.",
      story: "His pencil is blunt.",
      category: "gear",
      prop: "pencil",
    });
    expect(after.steps).toEqual(paused.steps);
    expect(after.current).toBe(paused.current);
    expect(after.paused).toBe(true);
    expect(after.rest?.stuckStory).toBe("His pencil is blunt.");
    expect(after.rest?.messages).toEqual([{ from: "him", text: "I cannot get on." }]);
    expect(after.pauseLog).toEqual([
      {
        step: 0,
        text: "I cannot get on.",
        story: "His pencil is blunt.",
        category: "gear",
        prop: "pencil",
      },
    ]);
    // He stays stuck until Back: the message is added once and never replaced.
    expect(addPauseMessage(after, { text: "Another." })).toBe(after);
  });

  it("test_56_ac5_the_pause_history_covers_the_last_two_categories_and_this_step_only", () => {
    const base = session();
    const logged: FocusSession = {
      ...base,
      current: 1,
      pauseLog: [
        { step: 0, text: "a.", story: "A.", category: "body", prop: "lamp" },
        { step: 0, text: "b.", story: "B.", category: "gear", prop: "desk" },
        { step: 1, text: "c.", story: "C.", category: "paper", prop: "pencil" },
      ],
    };
    expect(pauseHistory(logged)).toEqual({
      recentCategories: ["gear", "paper"],
      usedProps: ["pencil"],
      earlierStories: ["C."],
      earlierLines: ["A.", "a.", "B.", "b.", "C.", "c."],
    });
  });
});
