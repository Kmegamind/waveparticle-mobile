import { describe, expect, it } from "vitest";
import { PERIOD_DRAFTS, PERIOD_STATUS } from "@/content/oppenheimer/periods";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";
import { STORY_IDS, storyProfile } from "@/lib/prototype/story-inputs";
import { lifePath, storyForNewSession } from "@/lib/summary/life-path";

// Issue #258 (#50, #51): the Life Path with named periods and one current Story.

function session(storyId: string, state: ProgressSession["state"], line: string): ProgressSession {
  return {
    id: `${storyId}-${state}-${line.length}`,
    goalId: "g",
    companionId: "oppenheimer",
    storyId,
    state,
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: line,
    steps: [],
    lines: [],
  };
}

const account = (sessions: ProgressSession[]): AccountProgress => ({
  userId: "u",
  goals: [],
  sessions,
});

const rows = (view: ReturnType<typeof lifePath>) => view.periods.flatMap((period) => period.rows);

describe("#258 AC7 the periods (PERIODS)", () => {
  it("puts every story in exactly one period, in story order", () => {
    expect(PERIOD_DRAFTS.flatMap((period) => period.storyIds)).toEqual(STORY_IDS);
    expect(PERIOD_DRAFTS.map((period) => period.name)).toEqual([
      "His youth",
      "The Berkeley years",
      "The Manhattan Project years",
      "After the war",
      "The hearings",
      "His later years",
    ]);
    expect(PERIOD_STATUS).toMatch(/draft/);
  });

  it("shows no dates or ages", () => {
    const text = JSON.stringify(lifePath(account([])));
    expect(text).not.toMatch(/\b1[89]\d\d\b/);
    expect(text).not.toMatch(/\bage\b|\baged\b|years old/i);
  });
});

describe("#258 AC8 AC9 one current story (#50, #51)", () => {
  it("starts a new account at chapter 1, with every later story by title only", () => {
    const view = lifePath(account([]));
    expect(view.currentId).toBe("bohr-difficulties");
    const all = rows(view);
    expect(all[0]).toEqual({
      id: "bohr-difficulties",
      title: "The Trade of a Theorist",
      state: "current",
      line: storyProfile("bohr-difficulties").goalShort,
    });
    expect(all.slice(1).every((row) => row.state === "later" && row.line === null)).toBe(true);
    expect(all.filter((row) => row.state === "current")).toHaveLength(1);
  });

  it("current is the first story without a completion", () => {
    const view = lifePath(
      account([
        session("bohr-difficulties", "completed", "I sent it off."),
        session("site-search", "completed", "I chose the mesa."),
      ]),
    );
    expect(view.currentId).toBe("tolman-lecture");
    const byId = new Map(rows(view).map((row) => [row.id, row]));
    expect(byId.get("bohr-difficulties")).toMatchObject({
      state: "finished",
      line: "I sent it off.",
    });
    expect(byId.get("site-search")).toMatchObject({ state: "finished", line: "I chose the mesa." });
    expect(byId.get("tolman-lecture")?.state).toBe("current");
  });

  it("shows the line of the first completion and ignores restarted runs", () => {
    const view = lifePath(
      account([
        session("bohr-difficulties", "restarted", "I gave up."),
        session("bohr-difficulties", "completed", "First."),
        session("bohr-difficulties", "completed", "Second one."),
      ]),
    );
    expect(rows(view)[0]).toMatchObject({ state: "finished", line: "First." });
  });

  it("has no current story once every story is finished", () => {
    const view = lifePath(account(STORY_IDS.map((id) => session(id, "completed", "Done."))));
    expect(view.currentId).toBeNull();
  });
});

describe("#258 AC10 a new signed-in run plays the current story", () => {
  it("is chapter 1 for a new account and the next one after a finished story", () => {
    expect(storyForNewSession(account([]))).toBe("bohr-difficulties");
    expect(
      storyForNewSession(account([session("bohr-difficulties", "completed", "I sent it off.")])),
    ).toBe("tolman-lecture");
  });

  it("stays on the last story once the path is finished", () => {
    expect(
      storyForNewSession(account(STORY_IDS.map((id) => session(id, "completed", "Done.")))),
    ).toBe("fermi-award");
  });
});
