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
    // A progress write that leaves the Companion and story as they are still works (AC2).
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
