import { describe, expect, it } from "vitest";
import { readStoryDecks, storyCardRows } from "../scripts/story-cards/import.mjs";
import { fixPublishedCheckSql, fixPublishedSql } from "../scripts/story-cards/fix-published.mjs";

// #377 AC3: the data fix for the published cards whose text fails the checks. The script prints
// SQL only; these tests read the SQL it prints for a small fixture deck and never run it.

const FIXTURE = {
  alpha: {
    id: "alpha",
    background: "I am at the lab, and the night is long.",
    parts: [
      {
        n: 1,
        title: "Find the room.",
        cards: [
          { at: "s1", text: "Kitty's note said the room was open." },
          { at: "s2", text: "I took the key from the desk." },
        ],
      },
    ],
  },
};

const rows = () => storyCardRows(FIXTURE, ["alpha"], "opp");
const ADMIN = "owner@example.com";
const sql = () => fixPublishedSql(rows(), { by: ADMIN });
const statements = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n");

describe("#377 AC3 the fix for the published cards", () => {
  it("test_377_ac3_runs_in_one_transaction_with_literal_strings", () => {
    const text = statements(sql());
    expect(text.match(/^begin;$/gm)).toHaveLength(1);
    expect(text.match(/^commit;$/gm)).toHaveLength(1);
    expect(text.indexOf("begin;")).toBeLessThan(text.indexOf("set local standard_conforming"));
    expect(text.indexOf("$fix$;")).toBeLessThan(text.indexOf("commit;"));
  });

  it("test_377_ac3_carries_the_seed_text_of_every_card_with_quotes_doubled", () => {
    const text = sql();
    for (const card of rows().cards) {
      expect(text).toContain(`('${card.key}', '${card.body.replaceAll("'", "''")}')`);
    }
    expect(text).toContain("'Kitty''s note said the room was open.'");
  });

  it("test_377_ac3_publishes_through_the_admins_database_function_with_a_history_row", () => {
    const text = statements(sql());
    expect(text).toContain(
      "perform private.set_published_story_card(seed.key, next_version, 'publish');",
    );
    // The function writes the Publish history row; the script writes none of its own and changes
    // no published flag itself.
    expect(text).not.toMatch(/insert into public\.publish_history/);
    expect(text).not.toMatch(/update public\.story_cards/);
    expect(text).not.toMatch(/delete from/);
    expect(text).toMatch(
      /insert into public\.story_cards \(\s*key, version, story_id, kind, part, slice, position, body, created_by\s*\)/,
    );
  });

  it("test_377_ac3_stops_before_any_change_without_the_card_editing_migration", () => {
    const text = statements(sql());
    expect(text).toContain(
      "to_regprocedure('private.set_published_story_card(text, integer, text)') is null",
    );
    expect(text).toMatch(/raise exception '.*20261123000000_story_card_editing\.sql/);
  });

  it("test_377_ac3_changes_only_a_card_whose_published_text_differs_from_the_seed", () => {
    const text = statements(sql());
    // A second run finds the seed text published and changes nothing.
    expect(text).toMatch(/if live\.body = seed\.body then\s+continue;/);
  });

  it("test_377_ac3_skips_and_reports_a_card_edited_in_the_admin_after_the_import", () => {
    const text = statements(sql());
    expect(text).toMatch(/if version_count > 1 or live\.version <> 1 then/);
    expect(text).toContain("'skipped: edited in the admin'");
    expect(text).toContain("'skipped: no published version'");
    expect(text).toContain("'skipped: not in the database'");
    // The new version comes after the newest one, and is reported.
    expect(text).toContain("next_version := newest + 1;");
    expect(text).toContain("'published: the seed text'");
  });

  it("test_377_ac3_ends_with_the_report_after_the_commit", () => {
    const text = statements(sql()).trimEnd();
    expect(text.indexOf("commit;")).toBeLessThan(
      text.indexOf("select key, outcome, detail from story_card_fix_report"),
    );
    expect(text.endsWith("order by outcome, key;")).toBe(true);
    expect(text).toContain("drop table if exists pg_temp.story_card_fix_report;");
  });

  it("test_377_ac3_publishes_as_the_named_admin_account_so_history_names_it", () => {
    const text = statements(sql());
    expect(text).toContain(`where lower(u.email) = lower('${ADMIN}');`);
    expect(text).toContain("join public.content_roles r on r.user_id = u.id and r.role = 'admin'");
    expect(text).toMatch(/raise exception 'No admin account with the email %/);
    expect(text).toContain("perform set_config('request.jwt.claim.sub', admin_id::text, true);");
    // The account is set before any card changes, and only for this transaction.
    expect(text.indexOf("$who$;")).toBeLessThan(text.indexOf("$fix$;"));
  });

  it("test_377_ac3_without_an_admin_email_no_sql_is_printed", () => {
    expect(() => fixPublishedSql(rows(), { by: "" })).toThrow(/--by/);
    expect(() => fixPublishedSql(rows(), { by: "x'); drop table t; --@a.b" })).toThrow(/--by/);
  });

  it("test_377_ac3_the_same_deck_prints_the_same_sql", () => {
    expect(sql()).toBe(sql());
  });

  it("test_377_ac3_the_check_query_only_reads", () => {
    const text = statements(fixPublishedCheckSql(rows()));
    expect(text).not.toMatch(/\b(insert|update|delete|perform|begin|commit|create|drop)\b/i);
    expect(text).toMatch(/^with seed\(key, body\) as \(/m);
    for (const outcome of [
      "to publish",
      "done: the seed text is published",
      "skipped: edited in the admin",
      "skipped: no published version",
      "skipped: not in the database",
    ]) {
      expect(text).toContain(outcome);
    }
  });

  it("test_377_ac3_the_real_seed_prints_every_card", () => {
    const real = storyCardRows(readStoryDecks());
    const text = fixPublishedSql(real, { by: ADMIN });
    expect(text.match(/^ {2}\('crd\.opp\./gm)).toHaveLength(real.cards.length);
  });

  it("test_377_ac3_a_text_with_a_nul_character_is_refused", () => {
    const broken = rows();
    broken.cards[0].body = "I wait.\0";
    expect(() => fixPublishedSql(broken, { by: ADMIN })).toThrow(/NUL/);
  });
});
