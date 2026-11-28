import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN, asAccount, attempt, rows, storyDatabase } from "./support/story-database";

// #521: the database side of the preview (supabase/migrations/20261208000000_companion_preview.sql),
// run in an in-memory Postgres with every migration and the seed content. An account writes its own
// sessions with its own key through the API, so the database itself refuses a session on a
// Companion who is not public (Snape: enter_href null) unless the account is an admin or writer,
// and his story rows are not readable by a user. Every text is invented.

const USER = { id: "00000000-0000-4000-8000-000000000521", email: "user@invented.test" };
const WRITER = { id: "00000000-0000-4000-8000-0000000005b2", email: "writer@invented.test" };
const STORY = "inv-preview-story";
const OPP_STORY = "site-search";

let db: PGlite;
let goalCount = 0;

/** A Goal of this account (written without a signed-in account, as a script would). */
async function goalOf(userId: string): Promise<string> {
  goalCount += 1;
  const id = `00000000-0000-4000-9000-${String(goalCount).padStart(12, "0")}`;
  await db.exec(
    `insert into public.goals (id, user_id, title, text) values ('${id}', '${userId}', 'Invented goal', 'Invented goal');`,
  );
  return id;
}

const insertSession = (userId: string, goalId: string, companion: string, story: string) =>
  attempt(
    db,
    asAccount(
      userId,
      `insert into public.sessions (user_id, goal_id, step_count, seed, companion_id, story_id)
       values ('${userId}', '${goalId}', 1, 's', '${companion}', '${story}')`,
    ),
  );

beforeAll(async () => {
  db = await storyDatabase();
  // The API roles' table rights, as Supabase grants them by default (the stand-in has none).
  await db.exec(`
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.sessions, public.goals to authenticated;
insert into auth.users (id, email) values ('${USER.id}', '${USER.email}'), ('${WRITER.id}', '${WRITER.email}');
insert into public.content_roles (user_id, role) values ('${WRITER.id}', 'writer');
insert into public.stories (id, companion_id, sequence, title, period, goal_short, who, opening)
  values ('${STORY}', 'snape', 1, 'Invented story', 'Invented period', '', '', '');
`);
}, 120_000);

describe("#521 the database refuses a session on a Companion who is not public", () => {
  it("test_521_db_snape_is_not_public_and_oppenheimer_is", async () => {
    const companions = await rows<{ id: string; enter_href: string | null }>(
      db,
      "select id, enter_href from public.companions where id in ('snape', 'oppenheimer') order by id",
    );
    expect(companions).toEqual([
      { id: "oppenheimer", enter_href: "/companions/oppenheimer" },
      { id: "snape", enter_href: null },
    ]);
  });

  it("test_521_ac1_refusal_a_user_cannot_insert_a_snape_session", async () => {
    const message = await insertSession(USER.id, await goalOf(USER.id), "snape", STORY);
    expect(message).toMatch(/this Companion cannot be played by this account/);
  });

  it("test_521_ac1_refusal_a_user_cannot_label_a_snape_story_as_oppenheimer", async () => {
    const message = await insertSession(USER.id, await goalOf(USER.id), "oppenheimer", STORY);
    expect(message).toMatch(/cannot be played/);
  });

  it("test_521_ac1_refusal_a_user_cannot_move_an_oppenheimer_session_to_snape", async () => {
    const goal = await goalOf(USER.id);
    expect(await insertSession(USER.id, goal, "oppenheimer", OPP_STORY)).toBe("ok");
    const moved = await attempt(
      db,
      asAccount(
        USER.id,
        `update public.sessions set companion_id = 'snape', story_id = '${STORY}' where goal_id = '${goal}'`,
      ),
    );
    expect(moved).toMatch(/cannot be played/);
  });
});

// Fix round 1 (review I1): the app saves sessions only by upsert (src/lib/progress/
// supabase-progress.ts: PostgREST's INSERT ... ON CONFLICT (id) DO UPDATE with every column).
// Postgres runs the BEFORE INSERT trigger for every proposed row, so the check must let through a
// row that already exists for this account with the same Companion and story, and still refuse a
// new row or a change of Companion or story, by insert, update and upsert alike.
describe("#521 fix round 1: progress writes on an existing session are not re-checked", () => {
  let n = 0;
  const sessionId = () => {
    n += 1;
    return `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
  };

  /** The app's own write: supabase-js `sessions.upsert(rows)` as PostgREST runs it. */
  const appUpsert = (
    userId: string,
    row: { id: string; goal: string; companion: string; story: string; state: string },
  ) =>
    attempt(
      db,
      asAccount(
        userId,
        `insert into public.sessions (id, user_id, goal_id, step_count, state, seed, companion_id,
           story_id, background_card, background_card_source, merged_key_moments, closing_line)
         values ('${row.id}', '${userId}', '${row.goal}', 2, '${row.state}', '${row.id}',
           '${row.companion}', '${row.story}', null, null, '[]', null)
         on conflict (id) do update set user_id = excluded.user_id, goal_id = excluded.goal_id,
           step_count = excluded.step_count, state = excluded.state, seed = excluded.seed,
           companion_id = excluded.companion_id, story_id = excluded.story_id,
           background_card = excluded.background_card,
           background_card_source = excluded.background_card_source,
           merged_key_moments = excluded.merged_key_moments, closing_line = excluded.closing_line`,
      ),
    );

  /** A session row written without a signed-in account (a script, or an earlier backfill). */
  async function scriptRow(userId: string, companion: string, story: string) {
    const id = sessionId();
    const goal = await goalOf(userId);
    await db.exec(
      `insert into public.sessions (id, user_id, goal_id, step_count, seed, companion_id, story_id)
       values ('${id}', '${userId}', '${goal}', 2, 's', '${companion}', '${story}');`,
    );
    return { id, goal };
  }

  it("test_521_i1_a_progress_upsert_on_an_existing_unplayable_row_passes", async () => {
    // The 'unassigned' rows of the 20261106120000 backfill, and a Snape session the account owns.
    for (const [companion, story] of [
      ["unassigned", "unassigned"],
      ["snape", STORY],
    ]) {
      const row = await scriptRow(USER.id, companion, story);
      for (const state of ["open", "completed", "restarted"]) {
        expect(
          await appUpsert(USER.id, { ...row, companion, story, state }),
          `${companion} ${state}`,
        ).toBe("ok");
      }
      // A plain progress update too.
      expect(
        await attempt(
          db,
          asAccount(USER.id, `update public.sessions set state = 'on_hold' where id = '${row.id}'`),
        ),
      ).toBe("ok");
    }
  });

  it("test_521_i1_a_writer_whose_role_was_removed_still_saves_progress_on_her_snape_session", async () => {
    const goal = await goalOf(WRITER.id);
    const id = sessionId();
    const row = { id, goal, companion: "snape", story: STORY, state: "open" };
    expect(await appUpsert(WRITER.id, row)).toBe("ok");
    await db.exec(`delete from public.content_roles where user_id = '${WRITER.id}';`);
    try {
      expect(await appUpsert(WRITER.id, { ...row, state: "completed" })).toBe("ok");
      // A new Snape row is refused now that she has no role.
      expect(
        await appUpsert(WRITER.id, { ...row, id: sessionId(), goal: await goalOf(WRITER.id) }),
      ).toMatch(/cannot be played/);
    } finally {
      await db.exec(
        `insert into public.content_roles (user_id, role) values ('${WRITER.id}', 'writer');`,
      );
    }
  });

  it("test_521_i1_refusal_a_new_row_by_upsert_is_still_checked", async () => {
    const goal = await goalOf(USER.id);
    expect(
      await appUpsert(USER.id, {
        id: sessionId(),
        goal,
        companion: "snape",
        story: STORY,
        state: "open",
      }),
    ).toMatch(/cannot be played/);
    expect(
      await appUpsert(USER.id, {
        id: sessionId(),
        goal,
        companion: "oppenheimer",
        story: OPP_STORY,
        state: "open",
      }),
    ).toBe("ok");
  });

  it("test_521_i1_refusal_moving_an_existing_row_to_snape_is_refused_by_insert_update_and_upsert", async () => {
    const row = await scriptRow(USER.id, "oppenheimer", OPP_STORY);
    const toSnape = { ...row, companion: "snape", story: STORY, state: "open" };
    // Upsert (the app's write path).
    expect(await appUpsert(USER.id, toSnape)).toMatch(/cannot be played/);
    // Plain update.
    expect(
      await attempt(
        db,
        asAccount(
          USER.id,
          `update public.sessions set companion_id = 'snape', story_id = '${STORY}' where id = '${row.id}'`,
        ),
      ),
    ).toMatch(/cannot be played/);
    // Only the story changed (an Oppenheimer row given a Snape story).
    expect(
      await appUpsert(USER.id, { ...row, companion: "oppenheimer", story: STORY, state: "open" }),
    ).toMatch(/cannot be played/);
    // An unplayable legacy row moved to Snape is refused as well.
    const legacy = await scriptRow(USER.id, "unassigned", "unassigned");
    expect(
      await appUpsert(USER.id, { ...legacy, companion: "snape", story: STORY, state: "open" }),
    ).toMatch(/cannot be played/);
    // The row is unchanged.
    expect(
      await rows(db, `select companion_id, story_id from public.sessions where id = '${row.id}'`),
    ).toEqual([{ companion_id: "oppenheimer", story_id: OPP_STORY }]);
  });

  it("test_521_i1_refusal_another_accounts_row_id_gives_no_pass", async () => {
    // A user cannot borrow another account's existing Snape row id to skip the check: the existing
    // row must be this account's (the owner policies refuse the write in any case).
    const writerRow = await scriptRow(WRITER.id, "snape", STORY);
    const message = await appUpsert(USER.id, {
      ...writerRow,
      goal: await goalOf(USER.id),
      companion: "snape",
      story: STORY,
      state: "open",
    });
    expect(message).not.toBe("ok");
  });
});

describe("#521 fix round 1: the migration can be run again and its pre-apply count", () => {
  it("test_521_m1_the_migration_runs_again_on_a_database_that_has_it", async () => {
    const file = readFileSync(
      path.join(import.meta.dirname, "..", "supabase", "migrations", MIGRATION),
      "utf8",
    );
    expect(await attempt(db, `begin; ${file} rollback;`)).toBe("ok");
    expect(await attempt(db, file)).toBe("ok");
    expect(
      await rows(db, "select tgname from pg_trigger where tgname = 'sessions_companion_playable'"),
    ).toHaveLength(1);
    expect(
      await rows(db, "select policyname from pg_policies where tablename = 'stories'"),
    ).toEqual([{ policyname: "stories_read_public_or_editor" }]);
    // Still refuses after the second run.
    expect(await insertSession(USER.id, await goalOf(USER.id), "snape", STORY)).toMatch(
      /cannot be played/,
    );
  });

  it("test_521_human_step_pre_apply_count_finds_sessions_on_a_non_public_companion_or_missing_story", async () => {
    const count = async () => Number((await rows<{ count: string }>(db, PRE_APPLY_COUNT))[0].count);
    const before = await count();
    const [goal, other] = [await goalOf(USER.id), await goalOf(USER.id)];
    await db.exec(
      `insert into public.sessions (user_id, goal_id, step_count, seed, companion_id, story_id)
       values ('${USER.id}', '${goal}', 1, 's', 'oppenheimer', 'no-such-story'),
              ('${USER.id}', '${other}', 1, 's', 'oppenheimer', '${OPP_STORY}');`,
    );
    // The row on a missing story counts; the valid Oppenheimer row does not.
    expect(await count()).toBe(before + 1);
  });
});

/** The pre-apply count of the Human step (PR #530), exactly as the owner runs it. */
const PRE_APPLY_COUNT = `select count(*) from public.sessions s
where not exists (
  select 1 from public.stories st
  join public.companions c on c.id = st.companion_id
  where st.id = s.story_id
    and st.companion_id = s.companion_id
    and c.enter_href ~ '[^[:space:]]'
)`;

const MIGRATION = "20261208000000_companion_preview.sql";

describe("#521 the database refuses a session on a Companion who is not public (continued)", () => {
  it("test_521_i1_a_progress_write_on_a_valid_session_still_works", async () => {
    const goal = await goalOf(USER.id);
    expect(await insertSession(USER.id, goal, "oppenheimer", OPP_STORY)).toBe("ok");
    expect(
      await attempt(
        db,
        asAccount(
          USER.id,
          `update public.sessions set state = 'completed' where goal_id = '${goal}'`,
        ),
      ),
    ).toBe("ok");
  });

  it("test_521_ac1_an_admin_and_a_writer_can_write_a_snape_session", async () => {
    for (const account of [ADMIN, WRITER]) {
      expect(await insertSession(account.id, await goalOf(account.id), "snape", STORY)).toBe("ok");
    }
  });

  it("test_521_ac2_a_user_still_writes_an_oppenheimer_session", async () => {
    expect(await insertSession(USER.id, await goalOf(USER.id), "oppenheimer", OPP_STORY)).toBe(
      "ok",
    );
  });

  it("test_521_ac1_refusal_a_user_cannot_read_snapes_story_rows", async () => {
    const read = (userId: string) =>
      db.transaction(async (tx) => {
        await tx.exec(
          `set local request.jwt.claim.sub = '${userId}'; set local role authenticated;`,
        );
        return (
          await tx.query<{ id: string }>(
            "select id from public.stories where companion_id = 'snape'",
          )
        ).rows.map((row) => row.id);
      });
    expect(await read(USER.id)).toEqual([]);
    expect(await read(WRITER.id)).toEqual([STORY]);
    // Oppenheimer's stories stay readable to every signed-in account.
    const opp = await db.transaction(async (tx) => {
      await tx.exec(
        `set local request.jwt.claim.sub = '${USER.id}'; set local role authenticated;`,
      );
      return (await tx.query("select id from public.stories where companion_id = 'oppenheimer'"))
        .rows.length;
    });
    expect(opp).toBeGreaterThan(0);
  });

  it("test_521_m2_a_blank_address_with_tabs_or_newlines_is_not_public", async () => {
    for (const blank of ["E' '", "E'\\t'", "E'\\n'", "E' \\t\\r\\n '"]) {
      await db.exec(`update public.companions set enter_href = ${blank} where id = 'snape';`);
      try {
        expect(await insertSession(USER.id, await goalOf(USER.id), "snape", STORY), blank).toMatch(
          /cannot be played/,
        );
      } finally {
        await db.exec("update public.companions set enter_href = null where id = 'snape';");
      }
    }
  });

  it("test_521_ac4_setting_enter_href_opens_him_to_users", async () => {
    await db.exec(
      "update public.companions set enter_href = '/companions/snape' where id = 'snape';",
    );
    try {
      expect(await insertSession(USER.id, await goalOf(USER.id), "snape", STORY)).toBe("ok");
    } finally {
      await db.exec("update public.companions set enter_href = null where id = 'snape';");
    }
  });
});
