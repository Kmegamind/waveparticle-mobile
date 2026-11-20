import { describe, expect, it } from "vitest";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";
import { storyIds, storyProfile } from "@/lib/prototype/story-inputs";
import { PERIOD_STATUS, lifePath, storyForNewSession } from "@/lib/summary/life-path";
import { seedContent } from "./support/seed-content";

// The story content as the app reads it (#284), from the seed files.
const seed = seedContent();
const STORY_IDS = storyIds(seed);
// The periods as the Life Path groups them: each story's `period`, in story order (#284).
const PERIOD_DRAFTS = lifePath(seed, { userId: "u", goals: [], sessions: [] }).periods.map(
  (period) => ({ name: period.name, storyIds: period.rows.map((row) => row.id) }),
);

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
    const text = JSON.stringify(lifePath(seed, account([])));
    expect(text).not.toMatch(/\b1[89]\d\d\b/);
    expect(text).not.toMatch(/\bage\b|\baged\b|years old/i);
  });
});

describe("#258 AC8 AC9 one current story (#50, #51)", () => {
  it("starts a new account at chapter 1, with every later story by title only", () => {
    const view = lifePath(seed, account([]));
    expect(view.currentId).toBe("bohr-difficulties");
    const all = rows(view);
    expect(all[0]).toEqual({
      id: "bohr-difficulties",
      title: "The Trade of a Theorist",
      state: "current",
      line: storyProfile(seed, "bohr-difficulties").goalShort,
      recordHref: null,
    });
    expect(all.slice(1).every((row) => row.state === "later" && row.line === null)).toBe(true);
    expect(all.filter((row) => row.state === "current")).toHaveLength(1);
  });

  it("current is the first story without a completion", () => {
    const view = lifePath(
      seed,
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
      seed,
      account([
        session("bohr-difficulties", "restarted", "I gave up."),
        session("bohr-difficulties", "completed", "First."),
        session("bohr-difficulties", "completed", "Second one."),
      ]),
    );
    expect(rows(view)[0]).toMatchObject({ state: "finished", line: "First." });
  });

  it("has no current story once every story is finished", () => {
    const view = lifePath(seed, account(STORY_IDS.map((id) => session(id, "completed", "Done."))));
    expect(view.currentId).toBeNull();
  });
});

describe("#258 AC10 a new signed-in run plays the current story", () => {
  it("is chapter 1 for a new account and the next one after a finished story", () => {
    expect(storyForNewSession(seed, account([]))).toBe("bohr-difficulties");
    expect(
      storyForNewSession(
        seed,
        account([session("bohr-difficulties", "completed", "I sent it off.")]),
      ),
    ).toBe("tolman-lecture");
  });

  it("stays on the last story once the path is finished", () => {
    expect(
      storyForNewSession(seed, account(STORY_IDS.map((id) => session(id, "completed", "Done.")))),
    ).toBe("fermi-award");
  });
});

describe("#272 AC4 (#97 AC2) memory rows before the account's starting point", () => {
  it("marks the stories before a later start as his memory, never playable", () => {
    const view = lifePath(seed, account([]), "site-search");
    const all = rows(view);
    const index = all.findIndex((row) => row.id === "site-search");
    expect(all.slice(0, index).every((row) => row.state === "memory")).toBe(true);
    expect(all[0]).toEqual({
      id: "bohr-difficulties",
      title: "The Trade of a Theorist",
      state: "memory",
      line: storyProfile(seed, "bohr-difficulties").goalShort,
      recordHref: null,
    });
    expect(view.currentId).toBe("site-search");
    expect(all[index].state).toBe("current");
  });

  it("keeps a finished story finished even before the start", () => {
    const view = lifePath(
      seed,
      account([session("tolman-lecture", "completed", "I taught it whole.")]),
      "site-search",
    );
    expect(rows(view).find((row) => row.id === "tolman-lecture")).toMatchObject({
      state: "finished",
      line: "I taught it whole.",
    });
  });

  it("has no memory rows for the default start, chapter 1 (M1)", () => {
    expect(rows(lifePath(seed, account([]))).some((row) => row.state === "memory")).toBe(false);
  });
});

describe("#94 AC1 AC4 a finished row opens the record of that Story as played", () => {
  it("test_94_ac1_a_finished_row_links_the_record_of_the_run_whose_line_it_shows", () => {
    const first = session("bohr-difficulties", "completed", "First.");
    const view = lifePath(
      seed,
      account([
        session("bohr-difficulties", "restarted", "I gave up."),
        first,
        session("bohr-difficulties", "completed", "Second one."),
      ]),
    );
    expect(rows(view)[0]).toMatchObject({
      state: "finished",
      line: "First.",
      recordHref: `/me/history/${encodeURIComponent(first.id)}/chapter?from=life-path`,
    });
  });

  it("test_94_ac4_memory_current_and_later_rows_have_no_record", () => {
    const view = lifePath(seed, account([]), STORY_IDS[2]);
    for (const row of rows(view)) {
      expect(row.state).not.toBe("finished");
      expect(row.recordHref).toBeNull();
    }
  });
});
