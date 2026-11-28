import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { enterFor, reasonFor } from "@/app/companions/companions-list";
import { LifePathList } from "@/app/companions/oppenheimer/life-path-list";
import { companionRow } from "@/lib/admin/companion-rows";
import {
  PREVIEW_NOTE,
  companionHref,
  companionsForViewer,
  contentForViewer,
  goalHrefFor,
  isPublicCompanion,
  playableCompanion,
} from "@/lib/content/companion-access";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import { storyContentForRole } from "@/lib/content/repository";
import type { Story, StoryContent } from "@/lib/content/types";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  createMemoryProgressStore,
  type AccountProgress,
  type ProgressGoal,
  type ProgressSession,
} from "@/lib/progress/account-progress";
import {
  accountPauseMessage,
  accountRestReply,
  accountReturnLine,
} from "@/lib/progress/account-lines";
import { premadeStepCards } from "@/lib/progress/premade-cards";
import { openViewerFocusSession } from "@/lib/progress/viewer-session";
import { NOT_WRITTEN_YET, goalLinesFor } from "@/lib/prototype/goal-lines";
import { isStoryId, storyIds } from "@/lib/prototype/story-inputs";
import type { SafetyCheck } from "@/lib/safety/check";
import { finishAccountRun, summaryOf } from "@/lib/summary/finish-run";
import { lifePath, storyForNewSession } from "@/lib/summary/life-path";
import { createMemoryRunWriter } from "@/lib/summary/run-writer";
import { seedContent } from "./support/seed-content";

// #521 (folds in #485): Snape, or any Companion with stories, is playable for the owner before he
// is public. A Companion is public when his enterHref is set; one with stories and no enterHref is
// a preview for admins and writers only. Every text here is invented; no Snape card or story text.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const PREVIEW = "snape";

function invented(id: string, sequence: number): Story {
  return {
    id,
    companionId: PREVIEW,
    sequence,
    title: `Invented story ${sequence}`,
    period: "Invented period",
    // As after the drafts import: the screen lines stay empty until an admin publishes them.
    goalShort: "",
    who: "",
    opening: "",
    inputs: {
      goal: "Invented goal.",
      facts: [{ id: `${id}-f1`, taskId: "invented_aim", text: "Invented fact." }],
      forbiddenTerms: [],
      keySlices: [],
      stageZero: { story: { place: "Invented place." } },
      scene: null,
    },
  };
}

const seed = seedContent();
const STORY_A = "inv-locked-door";
const STORY_B = "inv-cold-room";
/** Every story: the seed (Oppenheimer, public) and two invented stories of Snape (no enterHref). */
const full: StoryContent = {
  companions: seed.companions,
  stories: [...seed.stories, invented(STORY_A, 1), invented(STORY_B, 2)],
};
const asUser = contentForViewer(full, null);
const asAdmin = contentForViewer(full, "admin");
const asWriter = contentForViewer(full, "writer");

const USER = "user-1";
const NOW = "2026-11-27T12:00:00.000Z";
const SESSION = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";

function goal(): ProgressGoal {
  return {
    id: "g1",
    title: "Write the report",
    text: "Write the report",
    status: "in_progress",
    steps: [
      { id: "s0", position: 0, title: "Outline", description: null, minutes: 10 },
      { id: "s1", position: 1, title: "Draft", description: null, minutes: 20 },
    ],
  };
}

/** A session on a Snape story, as an account could write one with its own key. */
function snapeSession(overrides: Partial<ProgressSession> = {}): ProgressSession {
  return {
    id: SESSION,
    goalId: "g1",
    companionId: PREVIEW,
    storyId: STORY_A,
    state: "open",
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: null,
    steps: [
      { id: "ss0", stepId: "s0", position: 0, openedAt: NOW, doneAt: null },
      { id: "ss1", stepId: "s1", position: 1, openedAt: null, doneAt: null },
    ],
    lines: [],
    ...overrides,
  };
}

const account = (sessions: ProgressSession[] = []): AccountProgress => ({
  userId: USER,
  goals: [goal()],
  sessions,
});

const ids = () => {
  let n = 0;
  return () => `id-${(n += 1)}`;
};

/** A model stand-in that records every call and answers any of them. */
function recordingGateway() {
  const calls: string[] = [];
  const gateway = new Proxy(
    {},
    {
      get: (_target, name) => async () => {
        calls.push(String(name));
        return {
          source: "generated",
          text: "Invented line.",
          closingLine: "Invented closing line.",
          carryLine: "Invented carried line.",
        };
      },
    },
  ) as ModelGateway;
  return { gateway, calls };
}

const noCrisis: SafetyCheck = async () => ({
  action: "continue",
  tier: "none",
  layer: "keyword",
});

describe("#521 who may play a Companion", () => {
  it("test_521_a_companion_is_public_when_his_enter_href_is_set", () => {
    const snape = full.companions.find((item) => item.id === PREVIEW)!;
    const opp = full.companions.find((item) => item.id === DEFAULT_COMPANION_ID)!;
    expect(isPublicCompanion(snape)).toBe(false);
    expect(isPublicCompanion(opp)).toBe(true);
    expect(isPublicCompanion({ enterHref: "  " })).toBe(false);
  });

  it("test_521_ac1_refusal_a_user_gets_no_story_of_a_companion_who_is_not_public", () => {
    expect(asUser.stories.some((story) => story.companionId === PREVIEW)).toBe(false);
    expect(isStoryId(asUser, STORY_A)).toBe(false);
    expect(storyIds(asUser, PREVIEW)).toEqual([]);
    expect(playableCompanion(asUser, PREVIEW)).toBeNull();
    // The Companions stay listed (the list shows him with Enter off).
    expect(asUser.companions.map((item) => item.id)).toContain(PREVIEW);
    // Oppenheimer is untouched (AC2).
    expect(storyIds(asUser)).toEqual(storyIds(seed));
  });

  it("test_521_ac1_an_admin_and_a_writer_get_his_stories", () => {
    for (const content of [asAdmin, asWriter]) {
      expect(storyIds(content, PREVIEW)).toEqual([STORY_A, STORY_B]);
      expect(isStoryId(content, STORY_A)).toBe(true);
      expect(playableCompanion(content, PREVIEW)?.id).toBe(PREVIEW);
    }
  });

  it("test_521_refusal_a_failed_role_read_counts_as_no_role", async () => {
    const content = await storyContentForRole(
      async () => full,
      async () => {
        throw new Error("role read failed");
      },
    );
    expect(isStoryId(content, STORY_A)).toBe(false);
    const admin = await storyContentForRole(
      async () => full,
      async () => "admin",
    );
    expect(isStoryId(admin, STORY_A)).toBe(true);
  });

  it("test_521_refusal_the_phone_pages_and_actions_read_the_public_or_the_viewers_content", () => {
    // getStoryContent() holds the public Companions only; the full content is admin code only.
    const repository = read("src/lib/content/repository.ts");
    expect(repository).toMatch(
      /export async function getStoryContent\(\)[^{]*\{\s*return contentForViewer\(await getFullStoryContent\(\), null\);/,
    );
    for (const file of [
      "src/app/focus/account-progress.ts",
      "src/app/focus/actions.ts",
      "src/app/rest/actions.ts",
      "src/app/end/actions.ts",
      "src/app/end/page.tsx",
      "src/app/goal/page.tsx",
      "src/app/companions/life-path-screen.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain("getStoryContentForViewer(");
      expect(source, file).not.toContain("getFullStoryContent");
    }
    // Only the admin's own code and the Companions list (which shows no story) read every story.
    expect(read("src/app/companions/page.tsx")).toContain("companionsForViewer(content, role)");
  });
});

describe("#521 the Companions list", () => {
  it("test_521_ac1_refusal_a_user_sees_snape_with_enter_off", () => {
    const listed = companionsForViewer(full, null);
    expect(enterFor(listed, PREVIEW)).toBeNull();
    expect(reasonFor(listed, PREVIEW)).toBe("His stories are not ready yet.");
    expect(enterFor(listed, DEFAULT_COMPANION_ID)).toBe("/companions/oppenheimer");
  });

  it("test_521_ac1_an_admin_gets_enter_to_his_life_path_marked_as_a_preview", () => {
    for (const role of ["admin", "writer"] as const) {
      const listed = companionsForViewer(full, role);
      expect(enterFor(listed, PREVIEW)).toBe("/companions/snape");
      expect(reasonFor(listed, PREVIEW)).toBe(PREVIEW_NOTE);
      expect(reasonFor(listed, DEFAULT_COMPANION_ID)).toBeNull();
    }
    // A Companion with no stories stays off for everyone.
    expect(enterFor(companionsForViewer(full, "admin"), "moriarty")).toBeNull();
  });

  it("test_521_ac4_one_change_makes_him_public", () => {
    const opened: StoryContent = {
      ...full,
      companions: full.companions.map((item) =>
        item.id === PREVIEW ? { ...item, enterHref: "/companions/snape" } : item,
      ),
    };
    const user = contentForViewer(opened, null);
    expect(storyIds(user, PREVIEW)).toEqual([STORY_A, STORY_B]);
    const listed = companionsForViewer(opened, null);
    expect(enterFor(listed, PREVIEW)).toBe("/companions/snape");
    expect(reasonFor(listed, PREVIEW)).toBeNull();
  });
});

describe("#521 the Life Path and the goal dialogue for any Companion", () => {
  it("test_521_ac1_snapes_life_path_has_his_stories_and_a_current_one", () => {
    const view = lifePath(asAdmin, account(), undefined, PREVIEW);
    expect(view.periods.map((period) => period.name)).toEqual(["Invented period"]);
    expect(view.currentId).toBe(STORY_A);
    expect(storyForNewSession(asAdmin, account(), PREVIEW)).toBe(STORY_A);
    // A finished Snape run moves his path on, never Oppenheimer's.
    const done = account([snapeSession({ state: "completed", closingLine: "Invented." })]);
    expect(lifePath(asAdmin, done, undefined, PREVIEW).currentId).toBe(STORY_B);
    expect(lifePath(asAdmin, done).currentId).toBe(lifePath(asAdmin, account()).currentId);
  });

  it("test_521_ac2_oppenheimer_keeps_his_plain_addresses", () => {
    expect(goalHrefFor(DEFAULT_COMPANION_ID)).toBe("/goal");
    expect(goalHrefFor(PREVIEW)).toBe("/goal?companion=snape");
    expect(companionHref(PREVIEW)).toBe("/companions/snape");
    const html = renderToStaticMarkup(
      createElement(LifePathList, { view: lifePath(seed, account()) }),
    );
    expect(html).toMatch(/href="\/goal"[^>]*>Begin</);
  });

  it("test_521_missing_story_lines_read_not_written_yet", () => {
    const html = renderToStaticMarkup(
      createElement(LifePathList, {
        view: lifePath(asAdmin, account(), undefined, PREVIEW),
        beginHref: goalHrefFor(PREVIEW),
      }),
    );
    expect(html).toContain("Not written yet");
    expect(html).toMatch(/href="\/goal\?companion=snape"[^>]*>Begin</);
  });

  it("test_521_the_goal_dialogue_never_shows_oppenheimers_own_lines_for_another_companion", () => {
    const other = goalLinesFor({ opening: "" });
    expect(other.opening).toBe(NOT_WRITTEN_YET);
    expect(other.splittingLine()).toBe(NOT_WRITTEN_YET);
    for (const shape of ["specific", "vague", "big"] as const) {
      for (const random of [0, 0.99]) {
        expect(other.reaction(shape, () => random)).not.toMatch(/canyon|site|ride|Dudley/i);
      }
    }
    expect(goalLinesFor({ opening: "Invented opening. What are you working on?" }).opening).toBe(
      "Invented opening. What are you working on?",
    );
    // The default Companion keeps his own lines (AC2).
    expect(goalLinesFor(null).opening).toMatch(/Jemez Springs/);
  });
});

describe("#521 a session with Snape", () => {
  it("test_521_ac1_an_admin_opens_a_new_session_with_snape_on_his_current_story", () => {
    const opened = openViewerFocusSession(asAdmin, account(), "g1", {
      companionId: PREVIEW,
      newId: ids(),
      now: NOW,
    })!;
    expect(opened.plan.companionId).toBe(PREVIEW);
    expect(opened.plan.storyId).toBe(STORY_A);
    expect(opened.writes.at(-1)).toMatchObject({ companionId: PREVIEW, storyId: STORY_A });
  });

  it("test_521_ac1_refusal_a_user_cannot_open_a_session_with_snape", () => {
    expect(
      openViewerFocusSession(asUser, account(), "g1", { companionId: PREVIEW, newId: ids() }),
    ).toBeNull();
  });

  it("test_521_ac1_refusal_a_session_row_a_user_wrote_for_snape_opens_nothing", () => {
    // The API lets an account write its own sessions; the server still refuses to play it.
    for (const companionId of [DEFAULT_COMPANION_ID, PREVIEW]) {
      expect(
        openViewerFocusSession(asUser, account([snapeSession()]), "g1", {
          companionId,
          newId: ids(),
        }),
      ).toBeNull();
    }
    // A Snape story under Oppenheimer's name is refused too, for every account.
    const mislabelled = account([snapeSession({ companionId: DEFAULT_COMPANION_ID })]);
    expect(
      openViewerFocusSession(asAdmin, mislabelled, "g1", {
        companionId: DEFAULT_COMPANION_ID,
        newId: ids(),
      }),
    ).toBeNull();
  });

  it("test_521_ac2_oppenheimer_opens_as_before_for_a_user", () => {
    const opened = openViewerFocusSession(asUser, account(), "g1", {
      companionId: DEFAULT_COMPANION_ID,
      newId: ids(),
      now: NOW,
    })!;
    expect(opened.plan.companionId).toBe(DEFAULT_COMPANION_ID);
    expect(opened.plan.storyId).toBe(storyForNewSession(seed, account()));
  });

  it("test_521_ac1_refusal_no_card_and_no_deck_read_for_a_story_the_account_may_not_play", async () => {
    const readDeck = vi.fn(async () => null);
    const answer = await premadeStepCards(
      { sessionId: SESSION, index: 0 },
      {
        readSession: async () => ({ storyId: STORY_A, stepCount: 2, cardVersions: null }),
        pinVersions: async () => undefined,
        readDeck,
        mayPlay: async (storyId) => isStoryId(asUser, storyId),
      },
    );
    expect(answer).toEqual({ status: "failed" });
    expect(readDeck).not.toHaveBeenCalled();
  });

  it("test_521_ac1_refusal_no_model_call_for_a_snape_story_from_a_user", async () => {
    const { gateway, calls } = recordingGateway();
    expect(
      await accountPauseMessage(asUser, { storyId: STORY_A, pauseNumber: 1 }, gateway),
    ).toEqual({ status: "failed" });
    expect(
      await accountRestReply(
        asUser,
        { storyId: STORY_A, message: "Hello", history: [], replyIndex: 0 },
        gateway,
        noCrisis,
      ),
    ).toEqual({ status: "failed" });
    expect(
      await accountReturnLine(
        asUser,
        { storyId: STORY_A, trigger: "rest", awayMinutes: 6 },
        gateway,
      ),
    ).toEqual({ status: "failed" });
    expect(calls).toEqual([]);
  });

  it("test_521_ac1_an_admin_gets_his_lines_for_a_snape_story", async () => {
    const { gateway, calls } = recordingGateway();
    expect(
      await accountReturnLine(
        asAdmin,
        { storyId: STORY_A, trigger: "rest", awayMinutes: 6 },
        gateway,
      ),
    ).toMatchObject({ status: "ok" });
    expect(
      await accountRestReply(
        asAdmin,
        { storyId: STORY_A, message: "Hello", history: [], replyIndex: 0 },
        gateway,
        noCrisis,
      ),
    ).toMatchObject({ status: "ok" });
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  async function finished(content: StoryContent) {
    const store = createMemoryProgressStore();
    const done = snapeSession({
      state: "completed",
      steps: [
        { id: "ss0", stepId: "s0", position: 0, openedAt: NOW, doneAt: NOW },
        { id: "ss1", stepId: "s1", position: 1, openedAt: NOW, doneAt: NOW },
      ],
    });
    await store.write(USER, { userId: USER, goals: [goal()], sessions: [done] });
    const { gateway, calls } = recordingGateway();
    const outcome = await finishAccountRun(
      { sessionId: SESSION },
      {
        userId: USER,
        store,
        writer: createMemoryRunWriter(store, USER),
        gateway,
        wait: async () => undefined,
        nowIso: NOW,
        loadContent: async () => content,
      },
    );
    return { outcome, calls, progress: await store.read(USER, USER) };
  }

  it("test_521_ac1_an_admin_finishes_a_snape_run_with_his_closing_line", async () => {
    const { outcome, progress } = await finished(asAdmin);
    expect(outcome).toEqual({
      status: "ok",
      shown: {
        closingLine: "Invented closing line.",
        carryLine: "Invented carried line.",
        next: STORY_B,
      },
    });
    expect(summaryOf(asAdmin, progress, SESSION)).toMatchObject({
      storyTitle: "Invented story 1",
      lifePathHref: "/companions/snape",
    });
  });

  it("test_521_ac1_refusal_a_user_gets_no_summary_and_no_closing_call_for_snape", async () => {
    const { outcome, calls, progress } = await finished(asUser);
    expect(outcome).toEqual({ status: "not-finished" });
    expect(calls).toEqual([]);
    expect(summaryOf(asUser, progress, SESSION)).toBeNull();
  });
});

describe("#521 the admin says who can see him", () => {
  it("test_521_snape_is_a_preview_not_published", () => {
    const stories = full.stories.map((story) => ({
      id: story.id,
      companion_id: story.companionId,
    }));
    expect(
      companionRow({ id: PREVIEW, key_code: "snp", enter_href: null }, stories, []).shown,
    ).toBe("Preview");
    expect(
      companionRow(
        { id: DEFAULT_COMPANION_ID, key_code: "opp", enter_href: "/companions/oppenheimer" },
        stories,
        [],
      ).shown,
    ).toBe("Published");
    expect(
      companionRow({ id: "moriarty", key_code: "mor", enter_href: null }, stories, []).shown,
    ).toBe("Not ready");
  });
});
