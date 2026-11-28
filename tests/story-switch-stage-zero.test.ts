import { execFileSync } from "node:child_process";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { newStageZero, writeInventedCardExport } from "../e2e/support/invented-card-export.mjs";
import {
  ADMIN,
  READER_KEY,
  attempt,
  dryRunReport,
  rows,
  storyDatabase,
} from "./support/story-database";

// #526: a story's switch-over also replaces its stage 0 slices, steps and scene with the export's,
// and its undo puts them back; a story not switched over keeps its stage 0, so phones behave as
// today. Run END TO END in an in-memory Postgres with every migration (PGlite), with INVENTED
// stories (e2e/support/invented-card-export.mjs), never a text of the owner's export.

const root = path.join(import.meta.dirname, "..");
const importScript = path.join(root, "scripts", "content", "import-drafts.mjs");
const switchScript = path.join(root, "scripts", "content", "switch-story.mjs");

const STORIES = [
  { id: "bohr-difficulties", cards: [3, 4, 2] },
  { id: "tolman-lecture", cards: [2, 6, 3, 1] },
];
const [SWITCHED, WAITING] = STORIES.map((story) => story.id);
const SWITCHED_KEYS = ["slices", "steps", "scene"];
const by = ["--by", ADMIN.email];

const printed = (script: string, ...args: string[]) =>
  execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const keep = (folder: string, ...mode: string[]) =>
  printed(importScript, folder, "--keep-published", ...mode);
const switchOver = (folder: string, story: string, ...mode: string[]) =>
  printed(switchScript, folder, story, ...mode);

type Stage = Record<string, unknown>;
/** The stage 0 values the export gives a story (what the switch-over writes). */
const exported = (story: (typeof STORIES)[number]): Stage => {
  const file = newStageZero(story.id, story.cards.length) as Stage;
  return Object.fromEntries(SWITCHED_KEYS.map((key) => [key, file[key]]));
};
const inputsOf = async (db: PGlite, story: string) =>
  (
    await rows<{ stage: Stage; next: Stage | null }>(
      db,
      `select stage_zero::jsonb as stage, stage_zero_next as next from story_inputs where story_id = '${story}'`,
    )
  )[0];
/** What phones and the app read: get_story_content with the server's reader key. */
const content = async (db: PGlite) =>
  (
    await rows<{ doc: { stories: { id: string; inputs: unknown }[] } }>(
      db,
      `select get_story_content('${READER_KEY}') as doc`,
    )
  )[0].doc;
const inputsInContent = async (db: PGlite, story: string) =>
  (await content(db)).stories.find((row) => row.id === story)?.inputs;
const waiting = async (db: PGlite) =>
  (
    await rows<{ doc: Record<string, Stage> | null }>(
      db,
      `select get_story_stage_zero_next('${READER_KEY}') as doc`,
    )
  )[0].doc;
const without = (stage: Stage, keys: string[]) =>
  Object.fromEntries(Object.entries(stage).filter(([key]) => !keys.includes(key)));
/** The exact text of a story's stage_zero and provenance (what an md5 check reads). */
const textsOf = async (db: PGlite, story: string) =>
  (
    await rows<{ stage: string; provenance: string }>(
      db,
      `select stage_zero::text as stage, provenance::text as provenance from story_inputs where story_id = '${story}'`,
    )
  )[0];
const publishedKeys = async (db: PGlite, story: string) =>
  (
    await rows<{ key: string }>(
      db,
      `select key from story_cards where story_id = '${story}' and published order by key`,
    )
  ).map((row) => row.key);

let db: PGlite;
let folder: string;
let stageBefore: Record<string, Stage>;
let contentBefore: Awaited<ReturnType<typeof content>>;
let keysBefore: string[];
let textsBefore: Record<string, { stage: string; provenance: string }>;

beforeAll(async () => {
  db = await storyDatabase();
  folder = writeInventedCardExport({ stories: STORIES, stageZero: true });
  stageBefore = Object.fromEntries(
    await Promise.all(STORIES.map(async (s) => [s.id, (await inputsOf(db, s.id)).stage])),
  );
  contentBefore = await content(db);
  keysBefore = await publishedKeys(db, SWITCHED);
  textsBefore = Object.fromEntries(
    await Promise.all(STORIES.map(async (s) => [s.id, await textsOf(db, s.id)])),
  );
}, 120_000);

describe("#526 the new stage 0 waits until each story's switch-over", () => {
  it("test_526_ac2_the_import_dry_run_reports_the_waiting_stage_0_and_no_phone_change", async () => {
    const report = await dryRunReport(db, keep(folder, "--dry-run"));
    const count = (what: string) => report.find((row) => row.what === what)?.count;
    expect(count("stage 0 files in the export")).toBe(STORIES.length);
    expect(count("stage 0 waiting for the switch-over")).toBe(STORIES.length);
    expect(count("stage 0 that phones read, changed")).toBe(0);
    expect((await inputsOf(db, SWITCHED)).next).toBeNull();
  });

  it("test_526_ac2_the_import_keeps_every_stage_0_phones_read_and_the_new_one_waits", async () => {
    expect(await attempt(db, keep(folder))).toBe("ok");
    for (const story of STORIES) {
      const inputs = await inputsOf(db, story.id);
      expect(inputs.stage).toEqual(stageBefore[story.id]);
      expect(inputs.next).toEqual(exported(story));
    }
    // Phones read exactly what they read before; the waiting stage 0 never reaches them.
    expect(await content(db)).toEqual(contentBefore);
    expect(JSON.stringify(await content(db))).not.toContain("Inventaleak");
    // The admin's checks read it with the reader key.
    expect(Object.keys((await waiting(db)) ?? {}).sort()).toEqual(
      [...STORIES.map((s) => s.id)].sort(),
    );
    expect(await rows(db, `select get_story_stage_zero_next('not-the-reader-key') as doc`)).toEqual(
      [{ doc: null }],
    );
    const check = await rows<{ item: string; result: string }>(db, keep(folder, "--check"));
    expect(check.filter((row) => row.item.startsWith("stage 0 "))).toEqual(
      STORIES.map((s) => ({ item: `stage 0 ${s.id}`, result: "ok, waiting for the switch-over" })),
    );
  });

  it("test_526_ac1_the_switch_dry_run_counts_the_stage_0_and_changes_nothing", async () => {
    const report = await dryRunReport(db, switchOver(folder, SWITCHED, ...by, "--dry-run"));
    expect(
      report.find((row) => row.what === "stage 0 replaced (slices, steps, scene)")?.count,
    ).toBe(1);
    expect((await inputsOf(db, SWITCHED)).stage).toEqual(stageBefore[SWITCHED]);
  });

  it("test_526_ac1_the_switch_publishes_retires_and_replaces_slices_steps_and_scene_of_that_story_only", async () => {
    expect(await attempt(db, switchOver(folder, SWITCHED, ...by))).toBe("ok");
    const story = STORIES[0];
    const inputs = await inputsOf(db, SWITCHED);
    for (const key of SWITCHED_KEYS) expect(inputs.stage[key]).toEqual(exported(story)[key]);
    // Every other value (the display places content_fields holds, people, voice, ...) stays.
    expect(without(inputs.stage, SWITCHED_KEYS)).toEqual(
      without(stageBefore[SWITCHED], SWITCHED_KEYS),
    );
    expect(inputs.next).toBeNull();
    // #533 review I2: marked as kept outside the repository, so the content scripts leave it.
    expect(JSON.parse((await textsOf(db, SWITCHED)).provenance)).toMatchObject({
      outsideRepository: true,
      switchedOver: "repository",
    });
    expect(JSON.parse((await textsOf(db, WAITING)).provenance).outsideRepository).toBeUndefined();
    // The cards switched too: the new set published, the old keys retired.
    const published = await publishedKeys(db, SWITCHED);
    expect(published).toContain(`crd.opp.${SWITCHED}.p1.c3`);
    expect(published).not.toContain(`crd.opp.${SWITCHED}.p4.c1`);
    expect(published).not.toEqual(keysBefore);
    // Phones read the new stage 0 of this story only.
    const read = (await inputsInContent(db, SWITCHED)) as { stage_zero: Stage };
    expect(read.stage_zero.slices).toEqual(exported(story).slices);
    expect(await inputsInContent(db, WAITING)).toEqual(
      contentBefore.stories.find((row) => row.id === WAITING)?.inputs,
    );
    // The other story keeps its stage 0 and its waiting one.
    const other = await inputsOf(db, WAITING);
    expect(other.stage).toEqual(stageBefore[WAITING]);
    expect(other.next).toEqual(exported(STORIES[1]));
    expect(Object.keys((await waiting(db)) ?? {})).toEqual([WAITING]);
    const check = await rows<{ item: string; result: string }>(
      db,
      switchOver(folder, SWITCHED, "--check"),
    );
    expect(check.filter((row) => row.result !== "ok")).toEqual([]);
    expect(check.map((row) => row.item)).toContain("stage 0");
    // A re-import leaves the switched story's stage 0 alone.
    expect(await attempt(db, keep(folder))).toBe("ok");
    expect((await inputsOf(db, SWITCHED)).next).toBeNull();
    const reimport = await rows<{ item: string; result: string }>(db, keep(folder, "--check"));
    expect(reimport.find((row) => row.item === `stage 0 ${SWITCHED}`)?.result).toBe(
      "ok, switched over",
    );
  });

  it("test_533_i2_the_content_import_never_overwrites_a_switched_story", async () => {
    const switched = await textsOf(db, SWITCHED);
    const other = await textsOf(db, WAITING);
    const sql = printed(path.join(root, "scripts", "content", "import.mjs"));
    expect(await attempt(db, sql)).toBe("ok");
    // The switched story keeps its new stage 0; the other story is written as before (unchanged).
    expect(await textsOf(db, SWITCHED)).toEqual(switched);
    expect((await textsOf(db, WAITING)).stage).toEqual(other.stage);
    expect((await inputsOf(db, SWITCHED)).stage.slices).toEqual(exported(STORIES[0]).slices);
  });

  it("test_526_ac1_the_undo_waits_when_the_stage_0_changed_after_the_switch", async () => {
    const { stage } = await textsOf(db, SWITCHED);
    await db.exec(
      `update story_inputs set stage_zero = jsonb_set(stage_zero::jsonb, '{scene,pauseProp}', '"invented cup"')::json where story_id = '${SWITCHED}'`,
    );
    expect(await attempt(db, switchOver(folder, SWITCHED, ...by, "--undo"))).toMatch(
      /the stage 0 of story .* changed after the switch-over/,
    );
    await db.query(`update story_inputs set stage_zero = $1::json where story_id = $2`, [
      stage,
      SWITCHED,
    ]);
  });

  it("test_526_ac1_the_undo_restores_cards_parts_and_the_stage_0_exactly", async () => {
    const report = await dryRunReport(
      db,
      switchOver(folder, SWITCHED, ...by, "--undo", "--dry-run"),
    );
    expect(
      report.find((row) => row.what === "stage 0 replaced (slices, steps, scene)")?.count,
    ).toBe(1);
    expect(await attempt(db, switchOver(folder, SWITCHED, ...by, "--undo"))).toBe("ok");
    const inputs = await inputsOf(db, SWITCHED);
    expect(inputs.stage).toEqual(stageBefore[SWITCHED]);
    expect(inputs.next).toEqual(exported(STORIES[0]));
    // #533 review M1: the same text, so an md5 check of the inputs matches again.
    expect(await textsOf(db, SWITCHED)).toEqual(textsBefore[SWITCHED]);
    expect(await publishedKeys(db, SWITCHED)).toEqual(keysBefore);
    expect(await content(db)).toEqual(contentBefore);
    expect(Object.keys((await waiting(db)) ?? {}).sort()).toEqual(
      [...STORIES.map((s) => s.id)].sort(),
    );
  });

  it("test_533_r2_i1_a_story_already_outside_the_repository_is_marked_outside", async () => {
    // As a #502 draft import: the story's inputs were never in the repository.
    const before = await textsOf(db, WAITING);
    await db.query(
      `update story_inputs set provenance = (provenance::jsonb || '{"outsideRepository": true}'::jsonb)::json where story_id = $1`,
      [WAITING],
    );
    const marked = await textsOf(db, WAITING);
    expect(await attempt(db, switchOver(folder, WAITING, ...by))).toBe("ok");
    expect(JSON.parse((await textsOf(db, WAITING)).provenance)).toMatchObject({
      outsideRepository: true,
      switchedOver: "outside",
    });
    const check = await rows<{ item: string; result: string }>(
      db,
      switchOver(folder, WAITING, "--check"),
    );
    expect(check.find((row) => row.item === "provenance")?.result).toBe("ok");
    expect(await attempt(db, switchOver(folder, WAITING, ...by, "--undo"))).toBe("ok");
    expect(await textsOf(db, WAITING)).toEqual(marked);
    await db.query(`update story_inputs set provenance = $1::json where story_id = $2`, [
      before.provenance,
      WAITING,
    ]);
  });

  it("test_526_the_import_undo_clears_the_waiting_stage_0", async () => {
    const report = await dryRunReport(db, keep(folder, "--undo", "--dry-run"));
    expect(report.find((row) => row.what === "stage 0 waiting cleared")?.count).toBe(
      STORIES.length,
    );
    expect(await attempt(db, keep(folder, "--undo"))).toBe("ok");
    for (const story of STORIES) {
      const inputs = await inputsOf(db, story.id);
      expect(inputs.next).toBeNull();
      expect(inputs.stage).toEqual(stageBefore[story.id]);
    }
    expect(await waiting(db)).toEqual({});
  });

  it("test_533_m6_a_stage_0_whose_steps_do_not_match_the_parts_is_refused", () => {
    const fewer = writeInventedCardExport({
      stories: STORIES,
      stageZero: true,
      change: (files) => {
        files[`app/stage0/${SWITCHED}.stage0.json`].steps.pop();
      },
    });
    expect(() => switchOver(fewer, SWITCHED, ...by, "--dry-run")).toThrow(
      /the steps of .* \(1, 2\) do not match the parts of parts_and_cards\.json \(1, 2, 3\)/,
    );
    const elsewhere = writeInventedCardExport({
      stories: STORIES,
      stageZero: true,
      change: (files) => {
        files[`app/stage0/${SWITCHED}.stage0.json`].steps[1].covers = ["s1"];
      },
    });
    expect(() => keep(elsewhere, "--dry-run")).toThrow(/step 2 of .* does not cover s2/);
  });

  it("test_526_a_switch_over_without_the_story_stage_0_file_is_not_printed", () => {
    const cardsOnly = writeInventedCardExport({ stories: STORIES });
    expect(() => switchOver(cardsOnly, SWITCHED, ...by)).toThrow(/no stage 0 file/);
  });
});
