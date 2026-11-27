import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  newCardText,
  newPartTitle,
  writeInventedCardExport,
} from "../e2e/support/invented-card-export.mjs";
import { storyDetail, storyList, type StoryCardRow } from "@/lib/story-cards/admin";
import {
  ADMIN,
  READER_KEY,
  asAccount,
  attempt,
  dryRunReport,
  lastRows,
  rows,
  storyDatabase,
} from "./support/story-database";

// #516: the regenerated Oppenheimer cards imported as drafts next to his published placeholder
// cards, then one story switched over and back, run END TO END in an in-memory Postgres with every
// migration and the repository's placeholder import. The new cards are INVENTED (never a text of
// the owner's export); every count is computed from the invented export or read from the database.

const root = path.join(import.meta.dirname, "..");
const importScript = path.join(root, "scripts", "content", "import-drafts.mjs");
const switchScript = path.join(root, "scripts", "content", "switch-story.mjs");

/** Three of his stories, regenerated with 3, 4 and 5 parts (the placeholders have 4). */
const STORIES = [
  { id: "bohr-difficulties", cards: [3, 4, 2] },
  { id: "tolman-lecture", cards: [2, 6, 3, 1] },
  { id: "truchas-morning", cards: [2, 2, 3, 2, 4] },
];
const [THREE, FOUR, FIVE] = STORIES.map((story) => story.id);
const exportedCards = (stories = STORIES) =>
  stories.reduce((sum, story) => sum + 1 + story.cards.reduce((a, b) => a + b, 0), 0);
const newKeys = (story: { id: string; cards: number[] }) => [
  `crd.opp.${story.id}.bg`,
  ...story.cards.flatMap((count, at) =>
    Array.from({ length: count }, (_, index) => `crd.opp.${story.id}.p${at + 1}.c${index + 1}`),
  ),
];

const printed = (script: string, ...args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const keep = (folder: string, ...mode: string[]) =>
  printed(importScript, folder, "--keep-published", ...mode);
const switchOver = (folder: string, story: string, ...mode: string[]) =>
  printed(switchScript, folder, story, ...mode);

type Card = StoryCardRow & { created_by: string | null };
const CARD_COLUMNS =
  "key, version, story_id, kind, part, slice, position, body, published, published_at::text, created_by";

const cardsOf = (db: PGlite, story: string) =>
  rows<Card>(
    db,
    `select ${CARD_COLUMNS} from story_cards where story_id = '${story}' order by key, version`,
  );
/** Every published or ever-published row of his, as text: what "nothing published changes" compares. */
const publishedRows = async (db: PGlite) =>
  (
    await rows<{ row: string }>(
      db,
      `select concat_ws('|', k.key, k.version, k.body, k.published, k.published_at) as row
       from story_cards k join stories s on s.id = k.story_id
       where s.companion_id = 'oppenheimer' and (k.published or k.published_at is not null)
       order by 1`,
    )
  ).map((row) => row.row);
/** The published rows now (key, version, text): what phones and the admin show as live. */
const liveRows = async (db: PGlite) =>
  (
    await rows<{ row: string }>(
      db,
      `select concat_ws('|', key, version, body) as row from story_cards where published order by 1`,
    )
  ).map((row) => row.row);
const partsOf = (db: PGlite, story: string) =>
  rows<{ part: number; title: string }>(
    db,
    `select part, title from story_parts where story_id = '${story}' order by part`,
  );
/** What a phone reads: get_story_cards with the server's reader key, published cards only. */
const phoneCards = async (db: PGlite, story: string) =>
  (
    await rows<{ doc: { cards: { key: string; version: number; body: string }[] } }>(
      db,
      `select get_story_cards('${READER_KEY}', '${story}', null) as doc`,
    )
  )[0].doc.cards;
const everything = (db: PGlite) =>
  rows(
    db,
    `select (select count(*) from story_cards)::int cards, (select count(*) from story_parts)::int parts,
      (select count(*) from publish_history)::int history, (select count(*) from private.story_switches)::int switches,
      (select md5(string_agg(concat_ws('|', key, version, body, published, published_at), ',' order by key, version)) from story_cards) digest`,
  );

let db: PGlite;
let folder: string;
const before: Record<string, Card[]> = {};
let publishedBefore: string[];
let liveBefore: string[];
let phoneBefore: Record<string, unknown>;

beforeAll(async () => {
  db = await storyDatabase();
  folder = writeInventedCardExport({ stories: STORIES });
  for (const story of STORIES) before[story.id] = await cardsOf(db, story.id);
  publishedBefore = await publishedRows(db);
  liveBefore = await liveRows(db);
  phoneBefore = Object.fromEntries(
    await Promise.all(STORIES.map(async (story) => [story.id, await phoneCards(db, story.id)])),
  );
}, 120_000);

describe("#516 the regenerated cards as drafts next to the published placeholders", () => {
  it("test_516_the_placeholders_are_published_with_four_parts_before_the_import", async () => {
    for (const story of STORIES) {
      expect(before[story.id].length).toBeGreaterThan(0);
      expect(before[story.id].every((card) => card.published)).toBe(true);
      expect(await partsOf(db, story.id)).toHaveLength(4);
    }
  });

  it("test_516_ac1_the_dry_run_shows_the_stories_part_titles_drafts_and_no_published_change", async () => {
    const start = await everything(db);
    // The SQL editor shows only the last result: the dry run stops with its report (#522 I2).
    const summary = await dryRunReport(db, keep(folder, "--dry-run"));
    const count = (what: string) => summary.find((row) => row.what === what)?.count;
    expect(count("stories in the export")).toBe(STORIES.length);
    expect(count("cards in the export")).toBe(exportedCards());
    expect(count("cards of the export that are drafts after the run")).toBe(exportedCards());
    expect(count("published rows changed")).toBe(0);
    expect(count("part titles changed")).toBe(0);
    expect(count("kept: editor draft")).toBe(0);
    expect(count("part titles in the export (set at the switch-over)")).toBe(
      STORIES.reduce((sum, story) => sum + story.cards.length, 0),
    );
    const titles = summary.filter((row) => row.what === "part title");
    expect(titles.map((row) => row.detail)).toContain(
      `${FIVE} part 5: now none; new ${newPartTitle(5)}`,
    );
    // The dry run ends in ROLLBACK: nothing changed.
    expect(await everything(db)).toEqual(start);
  });

  it("test_516_ac1_the_run_keeps_every_published_row_and_adds_each_card_as_a_new_draft_version", async () => {
    expect(await attempt(db, keep(folder))).toBe("ok");
    expect(await publishedRows(db)).toEqual(publishedBefore);
    for (const story of STORIES) {
      const now = await cardsOf(db, story.id);
      const placeholders = new Set(before[story.id].map((card) => card.key));
      for (const key of newKeys(story)) {
        const versions = now.filter((card) => card.key === key);
        const newest = versions.at(-1)!;
        const [, , , part, position] = key
          .match(/^crd\.opp\.([^.]+)\.(bg|p(\d)\.c(\d+))$/)!
          .slice(0);
        expect(newest.body).toBe(
          newCardText(story.id, part ? Number(part) : null, position ? Number(position) : 1),
        );
        expect(newest.published).toBe(false);
        expect(newest.published_at).toBeNull();
        // A key in both sets: the new text is version 2, the placeholder stays published as version 1.
        expect(newest.version).toBe(placeholders.has(key) ? 2 : 1);
        if (placeholders.has(key)) expect(versions[0].published).toBe(true);
      }
      // Old keys the new set does not have stay published and get no draft.
      for (const card of before[story.id].filter((row) => !newKeys(story).includes(row.key))) {
        expect(now.filter((row) => row.key === card.key)).toEqual([card]);
      }
      // Part titles change only at the switch-over.
      expect(await partsOf(db, story.id)).toHaveLength(4);
    }
    // The check's last statement is its SELECT, so the SQL editor shows every row.
    const check = await lastRows<{ item: string; result: string }>(db, keep(folder, "--check"));
    expect(check.length).toBeGreaterThan(exportedCards() - 1);
    expect(check.filter((row) => !row.result.startsWith("ok"))).toEqual([]);
    expect(
      check.filter((row) => row.result.startsWith("ok, published now; retired at")),
    ).not.toEqual([]);
  });

  it("test_516_ac3_phones_still_read_exactly_the_published_placeholders", async () => {
    for (const story of STORIES)
      expect(await phoneCards(db, story.id)).toEqual(phoneBefore[story.id]);
  });

  it("test_516_ac2_the_admin_story_shows_the_placeholders_and_the_new_drafts_apart", async () => {
    const story = { id: THREE, title: "Invented", sequence: 1 };
    const detail = storyDetail(
      story,
      await partsOf(db, THREE).then((parts) => parts.map((part) => ({ ...part, story_id: THREE }))),
      await cardsOf(db, THREE),
    )!;
    const all = [detail.background!, ...detail.parts.flatMap((part) => part.cards)];
    const shared = all.find((card) => card.key === `crd.opp.${THREE}.p1.c1`)!;
    expect(shared.published).toBe(true);
    expect(shared.draft?.body).toBe(newCardText(THREE, 1, 1));
    const added = all.find((card) => card.key === `crd.opp.${THREE}.p1.c3`)!;
    expect(added.published).toBe(false);
    expect(added.body).toBe(newCardText(THREE, 1, 3));
    const old = all.find((card) => card.key === `crd.opp.${THREE}.p4.c1`)!;
    expect(old.published).toBe(true);
    expect(old.draft).toBeNull();
  });

  it("test_516_ac1_a_rerun_changes_nothing_and_a_changed_export_replaces_only_its_drafts", async () => {
    const start = await everything(db);
    expect(await attempt(db, keep(folder))).toBe("ok");
    expect(await everything(db)).toEqual(start);
    // The export changes before the switch-over: one card fewer and one card reworded.
    const changed = writeInventedCardExport({
      stories: STORIES,
      change: (files) => {
        const cards = files["app/parts_and_cards.json"].stories[0].cards;
        files["app/parts_and_cards.json"].stories[0].cards = cards
          .filter((card: { key: string }) => card.key !== `crd.opp.${THREE}.p2.c4`)
          .map((card: { key: string; body: string }) =>
            card.key === `crd.opp.${THREE}.p1.c1`
              ? { ...card, body: "Invented reworded card." }
              : card,
          );
      },
    });
    expect(await attempt(db, keep(changed))).toBe("ok");
    expect(await publishedRows(db)).toEqual(publishedBefore);
    const now = await cardsOf(db, THREE);
    expect(now.filter((card) => card.key === `crd.opp.${THREE}.p2.c4`)).toEqual([]);
    expect(
      now.filter((card) => card.key === `crd.opp.${THREE}.p1.c1`).map((c) => c.version),
    ).toEqual([1, 2]);
    expect(
      now.find((card) => card.key === `crd.opp.${THREE}.p1.c1` && card.version === 2)?.body,
    ).toBe("Invented reworded card.");
    // Back to the first export.
    expect(await attempt(db, keep(folder))).toBe("ok");
    expect(await everything(db)).toEqual(start);
  });

  it("test_516_the_import_and_its_undo_refuse_a_story_that_is_not_one_of_his", async () => {
    const stranger = writeInventedCardExport({ stories: [{ id: "inv-not-his", cards: [1] }] });
    expect(await attempt(db, keep(stranger))).toMatch(/not one of this Companion's stories/);
    // #522 M3: the undo has the same guard, so it never removes another Companion's drafts.
    expect(await attempt(db, keep(stranger, "--undo"))).toMatch(
      /not one of this Companion's stories/,
    );
  });
});

describe("#516 AC4 a switch-over of one story, end to end, and its undo", () => {
  const by = ["--by", ADMIN.email];

  it("test_516_ac4_the_switch_refuses_before_the_import_and_for_an_unknown_account", async () => {
    const other = writeInventedCardExport({
      stories: [{ id: "midnight-pamphlet", cards: [2, 2, 2] }],
    });
    expect(await attempt(db, switchOver(other, "midnight-pamphlet", ...by))).toMatch(
      /run the draft import first/,
    );
    expect(await attempt(db, switchOver(folder, THREE, "--by", "nobody@invented.test"))).toMatch(
      /no admin account/,
    );
    // #522 M2: an account without the admin role is refused too.
    await db.exec(`insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-0000000000f1', 'phone@invented.test')`);
    expect(await attempt(db, switchOver(folder, THREE, "--by", "phone@invented.test"))).toMatch(
      /no admin account/,
    );
    expect(await attempt(db, switchOver(folder, THREE, ...by, "--undo"))).toMatch(/no switch-over/);
  });

  it("test_516_ac4_the_dry_run_lists_the_changes_and_changes_nothing", async () => {
    const start = await everything(db);
    const summary = await dryRunReport(db, switchOver(folder, THREE, ...by, "--dry-run"));
    const count = (what: string) => summary.find((row) => row.what === what)?.count;
    const story = STORIES[0];
    const retired = before[THREE].filter((card) => !newKeys(story).includes(card.key)).length;
    expect(count("cards published")).toBe(newKeys(story).length);
    expect(count("cards retired")).toBe(retired);
    expect(count("part titles now")).toBe(story.cards.length);
    expect(await everything(db)).toEqual(start);
  });

  it("test_516_ac4_only_the_new_cards_are_published_old_keys_retired_parts_and_history", async () => {
    expect(await attempt(db, switchOver(folder, THREE, ...by))).toBe("ok");
    const story = STORIES[0];
    const now = await cardsOf(db, THREE);
    const published = now.filter((card) => card.published);
    expect(published.map((card) => card.key).sort()).toEqual([...newKeys(story)].sort());
    for (const card of published)
      expect(card.body).not.toBe(before[THREE].find((b) => b.key === card.key)?.body);
    const retired = before[THREE].filter((card) => !newKeys(story).includes(card.key));
    expect(retired.length).toBeGreaterThan(0);
    for (const card of retired) {
      const row = now.find((entry) => entry.key === card.key)!;
      expect(row.published).toBe(false);
      // Sessions pinned to it can still read it: it was published once.
      expect(row.published_at).not.toBeNull();
    }
    expect(await partsOf(db, THREE)).toEqual(
      story.cards.map((_, at) => ({ part: at + 1, title: newPartTitle(at + 1) })),
    );
    expect((await phoneCards(db, THREE)).map((card) => card.body).sort()).toEqual(
      newKeys(story)
        .map((key) => now.find((card) => card.key === key && card.published)!.body)
        .sort(),
    );
    const history = await rows<{
      kind: string;
      item_key: string;
      version: number;
      action: string;
      acted_by: string;
    }>(
      db,
      `select kind, item_key, version, action, acted_by::text from publish_history order by id`,
    );
    expect(
      history.filter((row) => row.action === "publish" && row.kind === "story_card"),
    ).toHaveLength(newKeys(story).length);
    expect(
      history
        .filter((row) => row.action === "retire")
        .map((row) => row.item_key)
        .sort(),
    ).toEqual(retired.map((card) => card.key).sort());
    expect(history.filter((row) => row.kind === "story_switch")).toEqual([
      { kind: "story_switch", item_key: THREE, version: 1, action: "publish", acted_by: ADMIN.id },
    ]);
    expect(new Set(history.map((row) => row.acted_by))).toEqual(new Set([ADMIN.id]));
    // The other stories are untouched; their drafts wait for their own switch-over.
    for (const other of [FOUR, FIVE])
      expect(await phoneCards(db, other)).toEqual(phoneBefore[other]);
    const check = await rows<{ result: string }>(db, switchOver(folder, THREE, "--check"));
    expect(check.filter((row) => row.result !== "ok")).toEqual([]);
  });

  it("test_516_ac4_the_admin_marks_retired_cards_and_counts_only_the_new_parts", async () => {
    const story = { id: THREE, title: "Invented", sequence: 1 };
    const parts = (await partsOf(db, THREE)).map((part) => ({ ...part, story_id: THREE }));
    const cards = await cardsOf(db, THREE);
    const detail = storyDetail(story, parts, cards)!;
    const all = detail.parts.flatMap((part) => part.cards);
    const old = all.find((card) => card.key === `crd.opp.${THREE}.p4.c1`)!;
    expect(old.retired).toBe(true);
    expect(old.draft).toBeNull();
    const current = all.find((card) => card.key === `crd.opp.${THREE}.p1.c1`)!;
    expect(current.retired).toBe(false);
    expect(current.published).toBe(true);
    const [row] = storyList([story], parts, cards);
    expect(row.parts).toBe(STORIES[0].cards.length);
    expect(row.cards).toBe(STORIES[0].cards.reduce((a, b) => a + b, 0));
  });

  it("test_516_ac4_a_second_switch_is_refused_and_five_parts_switch_too", async () => {
    expect(await attempt(db, switchOver(folder, THREE, ...by))).toMatch(/already switched over/);
    expect(await attempt(db, switchOver(folder, FIVE, ...by))).toBe("ok");
    expect(await partsOf(db, FIVE)).toHaveLength(5);
    // The undo's dry run shows its counts too, and changes nothing.
    const start = await everything(db);
    const undoReport = await dryRunReport(
      db,
      switchOver(folder, FIVE, ...by, "--undo", "--dry-run"),
    );
    const undoCount = (what: string) => undoReport.find((row) => row.what === what)?.count;
    expect(undoCount("cards published again (undo)")).toBe(before[FIVE].length);
    expect(undoCount("part titles now")).toBe(4);
    expect(await everything(db)).toEqual(start);
    expect(await attempt(db, switchOver(folder, FIVE, ...by, "--undo"))).toBe("ok");
    expect(await partsOf(db, FIVE)).toHaveLength(4);
    expect(await phoneCards(db, FIVE)).toEqual(phoneBefore[FIVE]);
  });

  it("test_516_ac4_the_undo_waits_when_a_card_changed_after_the_switch", async () => {
    const key = `crd.opp.${THREE}.p1.c2`;
    const version = (
      await rows<{ v: number }>(
        db,
        `select version v from story_cards where key = '${key}' and published`,
      )
    )[0].v;
    await db.exec(
      `update story_cards set published = false where key = '${key}' and version = ${version}`,
    );
    expect(await attempt(db, switchOver(folder, THREE, ...by, "--undo"))).toMatch(
      /after the switch-over/,
    );
    await db.exec(
      `update story_cards set published = true where key = '${key}' and version = ${version}`,
    );
  });

  it("test_516_ac4_the_undo_puts_the_placeholders_back", async () => {
    const historyBefore = (await rows(db, "select id from publish_history")).length;
    expect(await attempt(db, switchOver(folder, THREE, ...by, "--undo"))).toBe("ok");
    expect(await phoneCards(db, THREE)).toEqual(phoneBefore[THREE]);
    expect(await liveRows(db)).toEqual(liveBefore);
    const now = await cardsOf(db, THREE);
    const publishedNow = now.filter((card) => card.published).map((c) => `${c.key}:${c.version}`);
    expect(publishedNow.sort()).toEqual(before[THREE].map((c) => `${c.key}:${c.version}`).sort());
    expect((await partsOf(db, THREE)).map((part) => part.part)).toEqual([1, 2, 3, 4]);
    const history = await rows<{ kind: string; action: string }>(
      db,
      `select kind, action from publish_history where id > ${historyBefore} order by id`,
    );
    expect(history.some((row) => row.kind === "story_card" && row.action === "roll_back")).toBe(
      true,
    );
    expect(history.some((row) => row.kind === "story_card" && row.action === "retire")).toBe(true);
    expect(history.at(-1)).toEqual({ kind: "story_switch", action: "roll_back" });
    // #522 M1: exactly as before, publish times included, and the new versions are drafts again.
    expect(await publishedRows(db)).toEqual(publishedBefore);
    const draftsBack = await rows<{ item: string; result: string }>(db, keep(folder, "--check"));
    expect(draftsBack.filter((row) => !row.result.startsWith("ok"))).toEqual([]);
    expect(
      draftsBack.filter(
        (row) => row.item.startsWith(`crd.opp.${THREE}.`) && row.result === "ok, draft",
      ),
    ).toHaveLength(newKeys(STORIES[0]).length);
    expect(await attempt(db, switchOver(folder, THREE, ...by))).toBe("ok");
    expect(await attempt(db, switchOver(folder, THREE, ...by, "--undo"))).toBe("ok");
  });

  it("test_516_the_import_undo_waits_for_a_switch_undo_and_removes_only_the_drafts", async () => {
    expect(await attempt(db, switchOver(folder, FOUR, ...by))).toBe("ok");
    expect(await attempt(db, keep(folder, "--undo"))).toMatch(/undo the switch-over/);
    expect(await attempt(db, switchOver(folder, FOUR, ...by, "--undo"))).toBe("ok");
    const editor = "00000000-0000-4000-8000-00000000ed17";
    await db.exec(`insert into auth.users (id, email) values ('${editor}', 'writer@invented.test');
      insert into story_cards (key, version, story_id, kind, part, slice, position, body, created_by)
      values ('crd.opp.${FOUR}.p2.c6', 2, '${FOUR}', 'part', 2, 's2', 6, 'Invented edit by an editor.', '${editor}')`);
    // The undo's dry run shows how many drafts it removes, and changes nothing.
    const start = await everything(db);
    const report = await dryRunReport(db, keep(folder, "--undo", "--dry-run"));
    expect(report.find((row) => row.what === "drafts removed")?.count).toBe(exportedCards());
    expect(report.find((row) => row.what === "published rows changed")?.count).toBe(0);
    expect(await everything(db)).toEqual(start);
    expect(await attempt(db, keep(folder, "--undo"))).toBe("ok");
    // Every published card is as before the import, publish times included (#522 M1); only an
    // editor's own later draft stays.
    expect(await liveRows(db)).toEqual(liveBefore);
    expect(await publishedRows(db)).toEqual(publishedBefore);
    for (const story of STORIES) {
      const left = (await cardsOf(db, story.id)).filter(
        (card) => !card.published && card.published_at === null,
      );
      expect(left.map((card) => card.created_by)).toEqual(story.id === FOUR ? [editor] : []);
    }
    for (const story of STORIES)
      expect(await phoneCards(db, story.id)).toEqual(phoneBefore[story.id]);
  });
});

describe("#522 I1 a re-import never buries an editor's draft", () => {
  const story = { id: "midnight-pamphlet", cards: [2, 3, 2] };
  const key = `crd.opp.${story.id}.p1.c1`;
  const by = ["--by", ADMIN.email];
  const save = (body: string) =>
    asAccount(ADMIN.id, `select public.save_story_card_draft('${key}', '${body}')`);
  const versionsOf = (fresh: PGlite) =>
    rows<{ version: number; body: string; published: boolean; editor: boolean }>(
      fresh,
      `select version, body, published, created_by is not null as editor from story_cards where key = '${key}' order by version`,
    );

  async function expectEditorKept(fresh: PGlite, exportFolder: string, editorBody: string) {
    // The dry run and the check name the key; no version with the file's text goes on top.
    const report = await dryRunReport(fresh, keep(exportFolder, "--dry-run"));
    expect(report.find((row) => row.what === "kept: editor draft")?.count).toBe(1);
    expect(
      report.filter((row) => row.what === "editor draft kept").map((row) => row.detail),
    ).toEqual([key]);
    expect(await attempt(fresh, keep(exportFolder))).toBe("ok");
    expect((await versionsOf(fresh)).at(-1)).toMatchObject({ body: editorBody, editor: true });
    const check = await rows<{ item: string; result: string }>(
      fresh,
      keep(exportFolder, "--check"),
    );
    expect(check.find((row) => row.item === key)?.result).toBe("kept: editor draft");
    // The switch-over publishes the editor's version, not the file's.
    expect(await attempt(fresh, switchOver(exportFolder, story.id, ...by))).toBe("ok");
    const published = (await versionsOf(fresh)).filter((row) => row.published);
    expect(published).toEqual([expect.objectContaining({ body: editorBody, editor: true })]);
  }

  it("test_522_i1_an_edit_saved_after_the_import_survives_a_re_import_and_is_published", async () => {
    const fresh = await storyDatabase();
    const exportFolder = writeInventedCardExport({ stories: [story] });
    expect(await attempt(fresh, keep(exportFolder))).toBe("ok");
    expect(await attempt(fresh, save("Invented edit after the import."))).toBe("ok");
    await expectEditorKept(fresh, exportFolder, "Invented edit after the import.");
  }, 60_000);

  it("test_522_i1_a_draft_saved_before_the_import_is_kept_and_is_published", async () => {
    const fresh = await storyDatabase();
    const exportFolder = writeInventedCardExport({ stories: [story] });
    expect(await attempt(fresh, save("Invented draft before the import."))).toBe("ok");
    await expectEditorKept(fresh, exportFolder, "Invented draft before the import.");
  }, 60_000);
});

describe("#516 the default mode of #514 still refuses a Companion with published rows", () => {
  it("test_516_the_default_run_without_keep_published_refuses_his_export", () => {
    const run = spawnSync(process.execPath, [importScript, folder], {
      cwd: root,
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/--keep-published/);
  });
});
