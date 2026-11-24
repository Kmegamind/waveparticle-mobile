import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";
import { screenState } from "@/lib/progress/account-progress";
import {
  NO_STORY,
  applyFocusSnapshot,
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
import { readResearchCondition, storyIsOff } from "@/lib/research/condition";
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
  it("test_114_the_migration_is_the_newest_and_runs_after_content_roles", () => {
    const names = readdirSync(path.join(root, "supabase", "migrations")).sort();
    expect(names.at(-1)).toBe(MIGRATION);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261116000000_content_roles.sql"),
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
    expect(sql()).toContain("revoke all on function public.research_condition() from public;");
    expect(sql()).toContain(
      "grant execute on function public.research_condition() to authenticated;",
    );
  });

  it("test_114_reads_the_condition_and_fails_closed", async () => {
    const client = (data: unknown, error: { code?: string } | null = null) => ({
      rpc: async () => ({ data, error }),
    });
    expect(await readResearchCondition(client("no_story"))).toBe("no_story");
    expect(await readResearchCondition(client(null))).toBeNull();
    expect(await readResearchCondition(client("something else"))).toBeNull();
    expect(await storyIsOff(client("no_story"))).toBe(true);
    // The migration has not run: nobody can be flagged yet.
    expect(await readResearchCondition(client(null, { code: "PGRST202" }))).toBeNull();
    // Any other failure throws, so the focus page never falls back to the Story.
    await expect(readResearchCondition(client(null, { code: "500" }))).rejects.toThrow();
  });

  it("test_114_deploy_says_how_to_assign_and_remove_with_one_sql_command", () => {
    const deploy = read("docs/deploy.md");
    expect(deploy).toMatch(/## Research flag/);
    expect(deploy).toMatch(
      /insert into public\.research_conditions \(user_id, condition\)\s+select id, 'no_story' from auth\.users where email = '[^']+'\s+on conflict \(user_id\) do update set condition = excluded\.condition;/,
    );
    expect(deploy).toMatch(/delete from public\.research_conditions/);
  });
});

describe("#114 AC1 the focus page in the study condition", () => {
  it("test_114_ac1_a_new_session_has_no_companion_and_no_story", () => {
    const result = openFocusSession(account(), "goal-1", {
      storyId: NO_STORY,
      storyOff: true,
      newId: ids(),
    })!;
    const session = result.writes[0];
    expect(session.companionId).toBe(NO_STORY);
    expect(session.storyId).toBe(NO_STORY);
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
      storyId: NO_STORY,
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

  it("test_114_ac1_the_focus_page_hides_his_side_and_the_rest_page_his_words", () => {
    const focus = read("src/app/_session/focus-body.tsx");
    expect(focus).toMatch(/\{storyOff \? null : \(\s*<section aria-labelledby="his-side"/);
    expect(focus).toMatch(/\{storyOff \? null : \(\s*<WhoIAmSheet/);
    expect(focus).toMatch(/returnPending && !storyOff \?/);
    expect(focus).toMatch(/\(storyOff \? noCards : loadStepCards\)\(/);
    const rest = read("src/app/_session/rest-body.tsx");
    expect(rest).toMatch(/\{storyOff \? null : \(\s*<>\s*<section aria-label="Conversation"/);
    const page = read("src/app/focus/account-focus.tsx");
    expect(page).toContain("storyOff: plan.storyOff");
    expect(page).toContain("plan.storyOff ? ACCOUNT_PATHS : accountPathsFor(plan.sessionId)");
  });

  it("test_114_ac1_the_server_refuses_his_lines_for_a_flagged_account", () => {
    const focus = read("src/app/focus/actions.ts");
    expect(
      focus.match(/storyIsOff\((client|signedIn\.client)\)\.catch\(\(\) => true\)/g),
    ).toHaveLength(2);
    const rest = read("src/app/rest/actions.ts");
    expect(rest).toMatch(/return !\(await storyIsOff\(client\)\.catch\(\(\) => true\)\);/);
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

    const frozen = openFocusSession(progress, "goal-1", {
      storyId: "site-search",
      storyOff: true,
      newId: ids(),
    })!;
    expect(frozen.writes).toHaveLength(1);
    expect(frozen.writes[0].id).toBe(first.plan.sessionId);
    expect(isStoryOff(frozen.writes[0])).toBe(true);
    expect(frozen.plan.storyOff).toBe(true);
    // The done Step stays done; the shown card stays in the record.
    expect(frozen.plan.done).toEqual([true, false]);
    expect(frozen.writes[0].lines.map((line) => line.text)).toEqual(["His card."]);
    // Seeding the device from the account keeps the done Step.
    expect(seedFocusSession(frozen.plan, 1, 0).current).toBe(1);
  });

  it("test_114_ac2_finishing_in_the_study_condition_makes_no_life_path_row", () => {
    const before = storyForNewSession(seed, account());
    const opened = openFocusSession(account(), "goal-1", {
      storyId: NO_STORY,
      storyOff: true,
      newId: ids(),
    })!;
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
    const opened = openFocusSession(account(), "goal-1", {
      storyId: NO_STORY,
      storyOff: true,
      newId: ids(),
    })!;
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
    expect(read("src/app/me/history-panel.tsx")).toMatch(
      /entry\.companion\s*\?\s*`\$\{entry\.companion\} · \$\{entry\.minutes\} min`\s*:\s*`\$\{entry\.minutes\} min`/,
    );
  });

  it("test_114_removing_the_flag_keeps_an_open_story_off_session_story_off", () => {
    const opened = openFocusSession(account(), "goal-1", {
      storyId: NO_STORY,
      storyOff: true,
      newId: ids(),
    })!;
    const progress = withWrites(account(), opened.writes);
    const again = openFocusSession(progress, "goal-1", { storyId: "site-search", newId: ids() })!;
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
