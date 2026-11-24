import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";
import { screenState } from "@/lib/progress/account-progress";
import {
  applyFocusSnapshot,
  doneWithStory,
  isStoryOff,
  openFocusSession,
  planStorageKey,
  seedFocusSession,
  snapshotOf,
} from "@/lib/progress/focus-session";
import {
  NO_CARDS,
  completeStep,
  doneLines,
  returnWithoutPopup,
  setStepCards,
  startRest,
  backFromRest,
  syncSession,
  visibleCards,
} from "@/lib/prototype/session";
import { readResearchCondition, resetResearchWarning, storyIsOff } from "@/lib/research/condition";
import { lifePath, storyForNewSession } from "@/lib/summary/life-path";
import { summaryOf } from "@/lib/summary/finish-run";
import { historyEntry, meView } from "@/lib/me/me-view";
import { sessionRecord, storyRecord } from "@/lib/me/records";
import { seedContent } from "./support/seed-content";

// #114 (US-MAP-11, decision M4): the internal research flag that turns the Story off.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = "20261129000000_research_conditions.sql";
const sql = () => read(`supabase/migrations/${MIGRATION}`).replace(/--.*$/gm, "");
const seed = seedContent();
const NOW = "2026-11-24T10:00:00.000Z";

function ids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function account(): AccountProgress {
  return {
    userId: "user-1",
    goals: [
      {
        id: "goal-1",
        title: "Write the report",
        text: "Write the report",
        status: "in_progress",
        kind: "one_time",
        steps: [
          { id: "step-a", position: 0, title: "Outline", description: "List it.", minutes: 10 },
          { id: "step-b", position: 1, title: "Draft", description: null, minutes: 15 },
        ],
      },
    ],
    sessions: [],
  };
}

const withWrites = (progress: AccountProgress, writes: ProgressSession[]): AccountProgress => ({
  ...progress,
  sessions: [
    ...progress.sessions.filter((session) => !writes.some((item) => item.id === session.id)),
    ...writes,
  ],
});

const STORY = "site-search";

/** A new Story-off session for the Goal, as /focus opens it with the flag on. */
function storyOffSession(progress = account()) {
  return openFocusSession(progress, "goal-1", {
    storyId: STORY,
    storyOff: true,
    now: NOW,
    newId: ids(),
  })!;
}

/** Every Step done through the browser's snapshot, as the focus page records it. */
function finishAll(progress: AccountProgress): AccountProgress {
  const session = progress.sessions.find((item) => item.state === "open")!;
  const result = applyFocusSnapshot(
    progress,
    { sessionId: session.id, current: 2, opened: [true, true], lines: [] },
    { now: NOW, newId: ids(), userId: "user-1" },
  )!;
  return { ...withWrites(progress, [result.session]), goals: [result.goal] };
}

describe("#114 the flag: a closed table read for the signed-in account only", () => {
  it("test_114_the_migration_runs_after_content_roles", () => {
    const names = readdirSync(path.join(root, "supabase", "migrations")).sort();
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261116000000_content_roles.sql"),
    );
  });

  it("test_114_the_migration_adds_story_off_at_and_closes_the_function_to_anon", () => {
    expect(sql()).toMatch(/alter table public\.sessions\s+add column story_off_at timestamptz;/);
    expect(sql()).toContain(
      "revoke all on function public.research_condition() from public, anon;",
    );
  });

  it("test_114_ac3_the_table_is_closed_to_the_api_and_has_no_policy", () => {
    expect(sql()).toMatch(/create table public\.research_conditions \(/);
    expect(sql()).toMatch(
      /user_id uuid primary key references auth\.users \(id\) on delete cascade/,
    );
    expect(sql()).toMatch(/condition text not null check \(condition in \('no_story'\)\)/);
    expect(sql()).toMatch(/alter table public\.research_conditions enable row level security;/);
    expect(sql()).toMatch(/revoke all on public\.research_conditions from anon, authenticated;/);
    expect(sql()).not.toMatch(/create policy/i);
    expect(sql()).not.toMatch(/service_role/);
  });

  it("test_114_the_function_answers_for_auth_uid_only", () => {
    const body = sql().slice(sql().indexOf("create function public.research_condition()"));
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/where r\.user_id = auth\.uid\(\)/);
    expect(sql()).toContain(
      "grant execute on function public.research_condition() to authenticated;",
    );
  });

  const rpcClient = (data: unknown, error: { code?: string } | null = null) => ({
    rpc: async () => ({ data, error }),
  });

  it("test_114_reads_the_condition_and_fails_closed", async () => {
    expect(await readResearchCondition(rpcClient("no_story"))).toBe("no_story");
    expect(await readResearchCondition(rpcClient(null))).toBeNull();
    expect(await readResearchCondition(rpcClient("something else"))).toBeNull();
    expect(await storyIsOff(rpcClient("no_story"))).toBe(true);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Any other failure throws, so the focus page never falls back to the Story.
    await expect(readResearchCondition(rpcClient(null, { code: "500" }), {})).rejects.toThrow();
    expect(error.mock.calls.join("\n")).toContain("research_read_failed");
    error.mockRestore();
  });

  it("test_114_i1_a_missing_function_reads_as_no_flag_with_one_warning_before_a_study", async () => {
    resetResearchWarning();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = rpcClient(null, { code: "PGRST202" });
    expect(await readResearchCondition(missing, {})).toBeNull();
    expect(await readResearchCondition(rpcClient(null, { code: "42883" }), {})).toBeNull();
    const lines = warn.mock.calls.map((call) => String(call[0]));
    expect(lines.filter((line) => line.includes("research_function_missing"))).toHaveLength(1);
    warn.mockRestore();
  });

  it("test_114_i1_a_missing_function_fails_closed_while_a_study_is_active", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const active = { RESEARCH_STUDY_ACTIVE: "1" };
    for (const code of ["PGRST202", "42883"]) {
      await expect(readResearchCondition(rpcClient(null, { code }), active)).rejects.toThrow();
    }
    const lines = error.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes('"reason":"function_missing"'))).toBe(true);
    error.mockRestore();
    // The setting does not change an answer that was read.
    expect(await readResearchCondition(rpcClient("no_story"), active)).toBe("no_story");
    expect(await readResearchCondition(rpcClient(null), active)).toBeNull();
  });

  it("test_114_i1_the_setting_is_documented", () => {
    expect(read(".env.example")).toMatch(/^RESEARCH_STUDY_ACTIVE=$/m);
    expect(read("docs/deploy.md")).toContain("RESEARCH_STUDY_ACTIVE=1");
  });

  it("test_114_deploy_says_how_to_assign_and_remove_with_one_sql_command", () => {
    const deploy = read("docs/deploy.md");
    expect(deploy).toMatch(/## Research flag/);
    expect(deploy).toMatch(
      /insert into public\.research_conditions \(user_id, condition\)\s+select id, 'no_story' from auth\.users where email = '[^']+'\s+on conflict \(user_id\) do update set condition = excluded\.condition, assigned_at = now\(\);/,
    );
    expect(deploy).toMatch(/delete from public\.research_conditions/);
  });
});

describe("#114 AC1 the focus page in the study condition", () => {
  it("test_114_ac1_a_new_session_keeps_its_story_and_is_marked_story_off", () => {
    const result = storyOffSession();
    const session = result.writes[0];
    expect(session.companionId).toBe("oppenheimer");
    expect(session.storyId).toBe(STORY);
    expect(session.storyOffAt).toBe(NOW);
    expect(isStoryOff(session)).toBe(true);
    expect(result.plan.storyOff).toBe(true);
    // The current Step with its description is on the plan.
    expect(result.plan.steps[0]).toEqual({
      title: "Outline",
      description: "List it.",
      minutes: 10,
    });
  });

  it("test_114_ac1_no_cards_and_the_clock_starts_at_once", () => {
    const plan = {
      goal: { text: "Write", minutes: 25 },
      steps: account().goals[0].steps.map((s) => ({
        title: s.title,
        description: s.description ?? "",
        minutes: s.minutes,
      })),
      storyId: STORY,
    };
    const base = syncSession(null, plan, 1);
    const started = setStepCards(base, 0, NO_CARDS, 1_000);
    expect(started.steps[0].clock).not.toBeNull();
    expect(visibleCards(started, 0, 10 * 60_000)).toEqual([]);
    // Done starts the next Step's clock after the hold once its (no) cards are in.
    const withNext = setStepCards(started, 1, NO_CARDS, 2_000);
    const next = completeStep(withNext, 5_000);
    expect(next.current).toBe(1);
    expect(next.steps[1].clock).not.toBeNull();
    expect(doneLines(next, 6_000)).toEqual([]);
    // Nothing is recorded as a card.
    expect(snapshotOf("s", next).lines).toEqual([]);
  });

  it("test_114_ac1_coming_back_never_opens_the_return_pop_up", () => {
    const plan = { goal: null, steps: [{ title: "A", description: "", minutes: 30 }] };
    const running = setStepCards(syncSession(null, plan, 1), 0, NO_CARDS, 0);
    // Back to step from the rest page.
    const back = backFromRest(startRest(running, 1_000));
    const resumed = returnWithoutPopup(back, 2_000);
    expect(resumed.returnPending).toBeNull();
    expect(resumed.paused).toBe(false);
    // Back after 5 minutes or more away.
    const away = { ...startRest(running, 1_000), rest: null };
    expect(returnWithoutPopup(away, 1_000 + 10 * 60_000).returnPending).toBeNull();
  });

  it("test_114_a_story_off_session_has_its_own_device_key", () => {
    expect(planStorageKey({ sessionId: "s1", storyOff: false })).toBe("waveparticle.session.s1");
    expect(planStorageKey({ sessionId: "s1", storyOff: true })).toBe(
      "waveparticle.session.s1.study",
    );
  });
});

describe("#114 AC2 the Story freezes and History still records the Goal and Step", () => {
  it("test_114_ac2_an_open_story_session_is_turned_story_off_in_place", () => {
    const first = openFocusSession(account(), "goal-1", { storyId: "site-search", newId: ids() })!;
    let progress = withWrites(account(), first.writes);
    const halfway = applyFocusSnapshot(
      progress,
      {
        sessionId: first.plan.sessionId,
        current: 1,
        opened: [true, false],
        lines: [{ step: 0, kind: "background", seq: 0, text: "His card.", pauseNumber: null }],
      },
      { now: NOW, newId: ids(), userId: "user-1" },
    )!;
    progress = withWrites(progress, [halfway.session]);

    const LATER = "2026-11-24T11:00:00.000Z";
    const frozen = openFocusSession(progress, "goal-1", {
      storyId: STORY,
      storyOff: true,
      now: LATER,
      newId: ids(),
    })!;
    expect(frozen.writes).toHaveLength(1);
    const session = frozen.writes[0];
    expect(session.id).toBe(first.plan.sessionId);
    // I3: the Companion and the story are kept; only the time the Story went off is added.
    expect(session.companionId).toBe("oppenheimer");
    expect(session.storyId).toBe(STORY);
    expect(session.storyOffAt).toBe(LATER);
    expect(frozen.plan.storyOff).toBe(true);
    // The done Step stays done; the shown card stays in the record, but none goes to the device.
    expect(frozen.plan.done).toEqual([true, false]);
    expect(session.lines.map((line) => line.text)).toEqual(["His card."]);
    expect(frozen.plan.cards).toEqual([[], []]);
    // The first Step was done with the Story on; the second is not done yet.
    expect(session.steps.map((step) => doneWithStory(session, step))).toEqual([true, null]);
    // Seeding the device from the account keeps the done Step.
    expect(seedFocusSession(frozen.plan, 1, 0).current).toBe(1);
    // A line the browser sends now is not stored.
    const tampered = applyFocusSnapshot(
      withWrites(progress, [session]),
      {
        sessionId: session.id,
        current: 2,
        opened: [true, true],
        lines: [{ step: 1, kind: "story_card", seq: 0, text: "Sneaked in.", pauseNumber: null }],
      },
      { now: "2026-11-24T12:00:00.000Z", newId: ids(), userId: "user-1" },
    )!;
    expect(tampered.session.lines.map((line) => line.text)).toEqual(["His card."]);
    expect(tampered.session.steps.map((step) => doneWithStory(tampered.session, step))).toEqual([
      true,
      false,
    ]);
  });

  it("test_114_i3_a_session_for_an_older_plan_is_restarted_unchanged", () => {
    const first = openFocusSession(account(), "goal-1", { storyId: STORY, newId: ids() })!;
    const progress = withWrites(account(), first.writes);
    progress.goals[0].steps = [
      { id: "step-c", position: 0, title: "Only", description: null, minutes: 20 },
    ];
    const again = openFocusSession(progress, "goal-1", {
      storyId: STORY,
      storyOff: true,
      now: NOW,
      newId: ids(),
    })!;
    expect(again.writes.map((session) => session.state)).toEqual(["restarted", "open"]);
    const [restarted, opened] = again.writes;
    expect(restarted.storyOffAt ?? null).toBeNull();
    expect(restarted.storyId).toBe(STORY);
    expect(opened.storyOffAt).toBe(NOW);
  });

  it("test_114_ac2_finishing_in_the_study_condition_makes_no_life_path_row", () => {
    const before = storyForNewSession(seed, account());
    const opened = storyOffSession();
    const done = finishAll(withWrites(account(), opened.writes));
    const session = done.sessions[0];
    expect(session.state).toBe("completed");
    expect(screenState(done).lifePath).toEqual([]);
    const view = lifePath(seed, done);
    expect(
      view.periods.flatMap((period) => period.rows).filter((row) => row.state === "finished"),
    ).toEqual([]);
    // The Story does not advance: the next session plays the same story.
    expect(storyForNewSession(seed, done)).toBe(before);
    // No summary (END is his closing line) and no Story record.
    expect(summaryOf(seed, done, session.id)).toBeNull();
    expect(storyRecord(seed, done, session.id)).toBeNull();
  });

  it("test_114_ac2_history_records_the_goal_and_steps_without_the_companion", () => {
    const opened = storyOffSession();
    const done = finishAll(withWrites(account(), opened.writes));
    const session = done.sessions[0];
    const entry = historyEntry(done, session, seed.companions)!;
    expect(entry.goalTitle).toBe("Write the report");
    expect(entry.companion).toBe("");
    expect(entry.minutes).toBe(25);
    expect(meView(done, seed.companions).history.map((item) => item.sessionId)).toEqual([
      session.id,
    ]);
    const record = sessionRecord(done, session.id, seed.companions)!;
    expect(record.doneSteps).toEqual(["Outline", "Draft"]);
    expect(record.storyRecordHref).toBeNull();
  });

  it("test_114_removing_the_flag_keeps_an_open_story_off_session_story_off", () => {
    const opened = storyOffSession();
    const progress = withWrites(account(), opened.writes);
    const again = openFocusSession(progress, "goal-1", { storyId: STORY, newId: ids() })!;
    expect(again.writes).toEqual([]);
    expect(again.plan.storyOff).toBe(true);
  });
});

describe("#114 AC3 no setting anywhere lets a user turn the Story off", () => {
  it("test_114_ac3_no_page_or_app_text_offers_a_story_switch", () => {
    const words =
      /story off|turn off the story|hide the story|without the story|plain timer|research|study condition/i;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.tsx$/.test(entry.name)) files.push(rel);
      }
    };
    walk("src/app/me");
    for (const file of files) {
      // Only what is rendered counts: strip comments.
      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(words);
    }
    const appText = JSON.parse(read("src/content/app-text.json")) as Record<string, unknown>;
    expect(JSON.stringify(appText)).not.toMatch(words);
  });

  it("test_114_ac3_no_browser_code_reads_or_writes_the_flag", () => {
    const condition = read("src/lib/research/condition.ts");
    expect(condition).toContain('rpc("research_condition")');
    // Only server files import it.
    for (const file of [
      "src/app/focus/account-progress.ts",
      "src/app/focus/actions.ts",
      "src/app/rest/actions.ts",
    ]) {
      expect(read(file), file).toContain('from "@/lib/research/condition"');
    }
    expect(read("src/app/focus/actions.ts")).toMatch(/^"use server";/);
    expect(read("src/app/rest/actions.ts")).toMatch(/^"use server";/);
    expect(read("src/app/focus/account-progress.ts")).not.toMatch(/"use client"/);
  });
});
