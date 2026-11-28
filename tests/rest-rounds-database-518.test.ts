import { readdirSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAccount, attempt, storyDatabase } from "./support/story-database";

// #518 (REST-ROUND-10): the round count of a Pause is kept on the account
// (supabase/migrations/20261210000000_rest_rounds.sql), run in an in-memory Postgres with every
// migration. Nothing here connects to a real database. Every id is invented.

const MIGRATION = "20261210000000_rest_rounds.sql";
const USER = { id: "00000000-0000-4000-8000-000000000518", email: "user@invented.test" };
const OTHER = { id: "00000000-0000-4000-8000-0000000005b8", email: "other@invented.test" };
const GOAL = "00000000-0000-4000-9000-000000000518";
const SESSION = "00000000-0000-4000-a000-000000000518";
const PAUSE = "00000000-0000-4000-b000-000000000518";
const NEXT_PAUSE = "00000000-0000-4000-b000-000000000519";

let db: PGlite;

/** One function call as a signed-in account; the result, or the error message. */
async function call(userId: string, sql: string): Promise<number | string> {
  try {
    const results = await db.exec(
      `begin; set local request.jwt.claim.sub = '${userId}'; set local role authenticated;
       select ${sql} as value;`,
    );
    await db.exec("commit");
    return (results.at(-1)?.rows[0] as { value: number }).value;
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    return error instanceof Error ? error.message : String(error);
  }
}

const read = (userId: string, pause = PAUSE, session = SESSION) =>
  call(userId, `public.rest_round('${session}', '${pause}')`);
const record = (userId: string, round: number, pause = PAUSE, session = SESSION) =>
  call(userId, `public.record_rest_round('${session}', '${pause}', ${round})`);

beforeAll(async () => {
  db = await storyDatabase();
  await db.exec(`
grant usage on schema public to authenticated;
insert into auth.users (id, email) values ('${USER.id}', '${USER.email}'), ('${OTHER.id}', '${OTHER.email}');
insert into public.goals (id, user_id, title, text) values ('${GOAL}', '${USER.id}', 'Invented goal', 'Invented goal');
insert into public.sessions (id, user_id, goal_id, step_count, seed, companion_id, story_id)
  values ('${SESSION}', '${USER.id}', '${GOAL}', 1, 's', 'oppenheimer', 'site-search');
`);
}, 120_000);

describe("#518 the round count migration", () => {
  it("test_518_the_migration_runs_after_every_earlier_one", () => {
    const names = readdirSync(path.join(import.meta.dirname, "..", "supabase", "migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261208000000_companion_preview.sql"),
    );
  });

  it("test_518_ac2_a_pause_with_no_reply_yet_is_round_zero", async () => {
    expect(await read(USER.id)).toBe(0);
  });

  it("test_518_ac1_ac4_only_the_next_round_is_counted_and_a_repeat_changes_nothing", async () => {
    expect(await record(USER.id, 1)).toBe(1);
    expect(await read(USER.id)).toBe(1);
    // A repeated write (the same reply recorded twice) and a skipped round change nothing.
    expect(await record(USER.id, 1)).toBe(1);
    expect(await record(USER.id, 3)).toBe(1);
    for (let round = 2; round <= 10; round += 1) {
      expect(await record(USER.id, round)).toBe(round);
    }
    // AC3: the count is on the account, so any later read (a reload) says round 10 was shown.
    expect(await read(USER.id)).toBe(10);
    expect(await record(USER.id, 11)).toMatch(/a rest round is 1 to 10/);
    expect(await read(USER.id)).toBe(10);
  });

  it("test_518_ac2_another_pause_of_the_same_session_starts_at_zero", async () => {
    expect(await read(USER.id, NEXT_PAUSE)).toBe(0);
    expect(await record(USER.id, 1, NEXT_PAUSE)).toBe(1);
  });

  it("test_518_another_account_reads_nothing_and_cannot_write", async () => {
    expect(await read(OTHER.id)).toBe(0);
    expect(await record(OTHER.id, 1, "00000000-0000-4000-b000-0000000005ff")).toMatch(
      /not a session of this account/,
    );
  });

  it("test_518_the_table_is_closed_to_the_api", async () => {
    const message = await attempt(
      db,
      asAccount(USER.id, "select count(*) from private.rest_rounds"),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("test_518_a_count_goes_with_its_session", async () => {
    await db.exec(`delete from public.sessions where id = '${SESSION}'`);
    const left = await db.query<{ n: number }>(
      "select count(*)::int as n from private.rest_rounds",
    );
    expect(left.rows[0].n).toBe(0);
  });

  it("test_518_the_migration_can_run_again", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      path.join(import.meta.dirname, "..", "supabase", "migrations", MIGRATION),
      "utf8",
    );
    expect(await attempt(db, sql)).toBe("ok");
  });
});
