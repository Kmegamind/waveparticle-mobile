// Test-only stand-in for the Supabase endpoints the Goals area calls, for the e2e run (#73).
// Never imported by the app: the e2e app's NEXT_PUBLIC_SUPABASE_URL points here.
//
// Each test signs in with its own access token, so parallel tests never share data:
//   POST /__seed   { token, user: { id, email }, tables: { profiles, goals, steps, sessions,
//                  session_steps, session_lines }, missingFunctions?: ["delete_my_account"],
//                  contentRole?: "admin" | "writer", researchCondition?: "no_story" | "fail" }
//   GET  /__tables?token=…   the dataset after the app's writes, with auth_users ([] once deleted)
//   GET  /health
//   GET  /auth/v1/user                (Authorization: Bearer <token>)
//   GET|PATCH /rest/v1/<table>?…      eq., in.(…), order, limit, select (all columns returned)
//   DELETE /rest/v1/<table>?…         the matching rows of this account (#521: Start on /goal)
//   POST /rest/v1/<table>             insert, or upsert with Prefer: resolution=merge-duplicates
//                                     or ignore-duplicates on `on_conflict` (default id) (#27)
//   POST /rest/v1/rpc/get_active_prompts  { reader_token } → the active prompts (the seed in
//        docs/ai/prompts as version 1, then as published in ADM-08) when the token is
//        STUB_PROMPTS_READ_TOKEN, otherwise no rows, as the real function (#282)
//   POST /rest/v1/rpc/list_prompt_versions (editors), save_prompt_draft (editors),
//        publish_prompt | roll_back_prompt (admin only), as 20261124000000 (#308);
//        POST /__prompts { reset: true | "<key>" } puts every prompt (true) or one key back,
//        with the matching history rows (#439);
//        POST /__prompts { token, seededView: true | null }   (#446) that account's
//        list_prompt_versions answers the seed prompts only (no drafts), and its prompt writes are
//        refused, so the visual gate reads no row another test writes
//   POST /rest/v1/rpc/get_story_content  { reader_key } → the seed story content (src/content,
//        docs/demo) when the key is STUB_CONTENT_READ_KEY, otherwise null, as the real function (#284)
//   GET  /rest/v1/stories | story_parts | story_cards   the seed rows (#293): stories for any
//                                     signed-in account, parts and cards for content editors only
//   POST /rest/v1/rpc/get_story_cards  { reader_key, story, versions } → the seed deck's cards as
//        version 1, published (#300), then as edited (#304); POST /__story_cards { failReads }
//        makes it fail, { reset: true } puts the cards, part titles and their history back;
//        { deck: { story, cards } } publishes an invented deck for one story, { restore: story }
//        puts that story's seed cards back (#516)
//   POST /rest/v1/rpc/save_story_card_draft | save_story_part_title (editors),
//        publish_story_card | roll_back_story_card (admin only), as 20261123000000 (#304)
//   GET  /rest/v1/companions | content_fields   the Companions (signed in) and the field versions
//        (content editors) (#309); companions and stories carry the edited fields as published
//   POST /rest/v1/rpc/save_content_field_draft (editors), publish_content_field |
//        roll_back_content_field (admin only), as 20261124000000 (#309): a publish writes the
//        Companion or story row, which get_story_content then returns; POST /__content_fields
//        { reset: true } puts the rows, the versions and their history back
//   POST /rest/v1/rpc/content_role        the seeded contentRole ("admin", "writer") or null, as
//                                          public.content_role() for the caller (#287)
//   POST /rest/v1/rpc/research_condition  the seeded researchCondition ("no_story") or null, as
//                                          public.research_condition() for the caller (#114)
//   POST /rest/v1/rpc/rest_round | record_rest_round   a Pause's round count (#518), per account,
//                                          as 20261210000000_rest_rounds.sql
//   POST /rest/v1/rpc/delete_my_account   mirrors the migration (#103): the caller's rows, then
//                                          the auth user
//   POST /auth/v1/logout              204, also to the browser (cross-origin headers, #287)
//   GET  /rest/v1/app_text            app text shared by every test (#288), seeded from
//                                     src/content/app-text.json as version 1, published: anon and
//                                     no-role accounts get published rows only, as the policy;
//                                     editors get every row
//   POST /rest/v1/rpc/save_app_text_draft | publish_app_text | roll_back_app_text
//                                     mirror the migration, with its editor check
//                                     publish and roll back also write a publish history row (#289)
//   POST /rest/v1/rpc/list_publish_history   the history, newest first, with the editor's email
//                                     and is_current, for content editors only (403 otherwise)
//   GET  /rest/v1/hotlines            the hotline list (#118), seeded from src/content/hotlines.json
//                                     as version 1, published: signed-in accounts read published
//                                     rows, content editors every row
//   POST /rest/v1/rpc/save_hotline_draft | publish_hotline | roll_back_hotline   admin only, as
//                                     20261128000000; publish and roll back write a history row
//   POST /__hotlines  { reset: true }  puts the list and its history rows back
//   POST /__hotlines  { token, own: "seeded" | "copy" | null }   (#448) that account reads and
//                                     writes its own copy of the seed list, not the shared one:
//                                     "seeded" is read only (its writes are refused), so the visual
//                                     gate reads no row another test writes; "copy" takes saves,
//                                     publishes and roll backs (history rows as usual)
//   GET  /rest/v1/ai_features | ai_feature_status_history | ai_feature_test_runs   the AI feature
//                                     pages (#436), seeded from docs/ai/AI_11_feature-pages.md
//                                     (scripts/ai-features/seed.mjs), every status exploring, no
//                                     history and no test runs: content editors read every row,
//                                     other accounts none, as the policies
//   POST /rest/v1/rpc/save_ai_feature_sections (editors) | set_ai_feature_status (admin only,
//                                     with a history row), as 20261130000000
//   POST /rest/v1/rpc/list_ai_feature_people (editors) { target_feature }   the email of each
//                                     account in that feature's status history or as its last
//                                     editor, as 20261201000000 (#453)
//   POST /__ai_features { token, own: true | null }   (#453) that account gets its own copy of
//                                     the features and their status history (null gives it up):
//                                     its reads, save_ai_feature_sections, set_ai_feature_status
//                                     and list_ai_feature_people use the copy, so an editing test
//                                     never writes a row that another test or the visual gate reads
//   POST /__ai_features { reset?: true, testRuns?: [...] }   puts the features back (and removes
//                                     their history and test runs); testRuns adds rows as the
//                                     SQL of scripts/ai-features/import-runs.mjs would
//   #473 (registry, 20261202000000_ai_registry.sql): the 7 rows carry the registry columns
//                                     (feature_id R-01 to R-07, category runtime, empty fields,
//                                     example none); GET ai_feature_field_history |
//                                     ai_feature_example_history (editors); POST
//                                     /rest/v1/rpc/save_ai_feature_fields | set_ai_feature_example
//                                     (editors) | set_ai_feature_category (admin only), each with its
//                                     history rows; save_ai_feature_sections also writes field history.
//                                     Prompts carry a category (runtime); get_active_prompts returns
//                                     runtime rows only; a draft keeps its key's category;
//                                     POST /__prompts { importRows: [{ key, body, category }] } adds a
//                                     key as the SQL of scripts/ai-features/import-pipeline-prompts.mjs
//                                     would (version 1, active, only when the key is missing);
//                                     reset: true or reset: "<key>" removes it again
//   #476 (run log, 20261203000000_ai_runs.sql): POST /rest/v1/rpc/start_ai_run { server_token,
//                                     run } (status running; run_by and run_at set here) and
//                                     finish_ai_run { server_token, run_id, result } (the starter,
//                                     once), both with the prompt reader token and a content
//                                     editor, GET /rest/v1/ai_runs | ai_run_steps
//                                     (editors), POST /rest/v1/rpc/ai_run_spend { from_time,
//                                     to_time } (editors), as the migration
//   POST /__ai_features { token, purpose: { "<slug>": [items] } | null }   for that account only,
//                                     reads of ai_features show these purpose items (#439: a
//                                     layout test that no other test, nor the visual gate, sees);
//                                     null removes them. Reset does not touch them
//   POST /__ai_features { token, registry: true | null }   (#474) that account reads its own
//                                     copy of the 19 registry rows, made from the invented fixtures
//                                     in tests/fixtures/ai-registry/, and its list_prompt_versions
//                                     answers the seed prompts, the 12 fixture Pipeline and Quality
//                                     gate prompts and one fixed draft of stuck_story (its prompt
//                                     writes are refused); null gives both up. __fail_reads with
//                                     an AI feature table name makes that table's read answer 500.
//                                     #517: with storedVersions: true that account also reads the
//                                     R-08 row (rest_reply_review, storedVersionFeature) and the
//                                     stored versions of storedVersionPrompts (an earlier rest_reply
//                                     v2, a rest_reply draft v3, an inactive rest_reply_review v1)
//   POST /__publish_history { token, own: true | null }   (#447) that account's
//                                     list_publish_history answers a fixed, seeded history (three
//                                     rows, as the prototype) instead of the shared one, so the
//                                     visual gate never reads a row another test writes (#460);
//                                     null gives it up
//   POST /__publish_history { token, append: { kind, item_key, version } }   (#460) adds a publish
//                                     row by that account to the shared history, as an editing
//                                     test's publish writes one, without changing any content;
//                                     { token, remove: "<item_key>" } takes that account's rows
//                                     of that key out again
//   POST /__fail_reads { token, tables: ["profiles"] }   reads of those tables answer 500 for that
//                                     account until set again (#118, a failed profile read);
//                                     "auth" makes GET /auth/v1/user answer 500
//   POST /__app_text  { failReads?: boolean, reset?: true | "<key>" }   published reads without a
//                                     user session answer 503 while failReads is on (database
//                                     down); reset puts every key (true) or one key back to the
//                                     seed and removes the matching history rows
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { readPromptDirectory } from "../../scripts/prompts/prompt-files.mjs";
import { readAppTextSeed } from "../../scripts/app-text/import.mjs";
import { appDocument, readContentRows } from "../../scripts/content/content-files.mjs";
import { readStoryDecks, storyCardRows } from "../../scripts/story-cards/import.mjs";
import { readFeatureSeed, RUNTIME_FEATURE_IDS, STATUSES } from "../../scripts/ai-features/seed.mjs";
import { readRegistrySeed } from "../../scripts/ai-features/registry-seed.mjs";
import { readPipelinePrompts } from "../../scripts/ai-features/import-pipeline-prompts.mjs";
import { registryEditingRoute } from "./stub-ai-registry-editing.mjs";
import { handleAiSamples } from "./stub-ai-samples.mjs";
import {
  draftStoryContent,
  draftTables,
  inventedDeckRows,
  keptDraftTables,
} from "./stub-drafts.mjs";
import { handleAiRuns } from "./stub-ai-runs.mjs";
import { handleAiComparisons } from "./stub-ai-comparisons.mjs";
/** #473: the text fields save_ai_feature_fields writes, in its argument order, and their limits. */
const REGISTRY_TEXT_FIELDS = [
  "where_used",
  "requirement",
  "output_format",
  "design_rationale",
  "room_to_improve",
  "notes",
];
const REGISTRY_FIELD_MAX = [300, 4000, 4000, 4000, 4000, 4000];

const promptDirectory = fileURLToPath(new URL("../../docs/ai/prompts", import.meta.url));
const promptReaderToken = process.env.STUB_PROMPTS_READ_TOKEN ?? "";
const contentReadKey = process.env.STUB_CONTENT_READ_KEY ?? "";
/** The Companion and story rows once the import has run (#284), with the #309 columns. */
const seededContentRows = () => {
  const rows = readContentRows();
  return {
    ...rows,
    companions: rows.companions.map((row) => ({ ...row, who: "" })),
    stories: rows.stories.map((row) => ({ ...row, path: "" })),
  };
};
let contentRows = seededContentRows();
/** Every version of every edited field (#309), as public.content_fields. */
let contentFields = [];
/** What get_story_content returns: without the two #309 columns, as the real function. */
const without = (row, column) =>
  Object.fromEntries(Object.entries(row).filter(([name]) => name !== column));
/** The hosted API's row limit per request (Supabase's default max_rows), for the story tables. */
const STORY_PAGE_ROWS = 1000;
/** #502: the invented draft stories of e2e/support/stub-drafts.mjs, as after the import. */
const drafted = draftStoryContent();
const storyContentDocument = () =>
  appDocument({
    ...contentRows,
    companions: contentRows.companions.map((row) => without(row, "who")),
    stories: [...contentRows.stories.map((row) => without(row, "path")), ...drafted.stories],
    storyInputs: [...contentRows.storyInputs, ...drafted.storyInputs],
  });

const storyCards = storyCardRows(readStoryDecks());
/** Every card version and part title, as after the import; editable through the #304 functions. */
const seededCardVersions = () =>
  storyCards.cards.map((card) => ({
    ...card,
    version: 1,
    published: true,
    published_at: "2026-11-16T00:00:00Z",
  }));
let cardVersions = seededCardVersions();
let partTitles = storyCards.parts.map((part) => ({ ...part }));
/** #516 AC5: story id -> the invented published deck get_story_cards answers instead. */
const deckOverrides = new Map();

/** Every prompt version (#308): the seed as version 1, active, as after the import. */
const seededPrompts = () =>
  readPromptDirectory(promptDirectory).map((row) => ({
    key: row.key,
    version: 1,
    active: true,
    body: row.body,
    params: row.params,
    note: row.note ?? "",
    created_at: "2026-11-14T00:00:00Z",
    activated_at: "2026-11-14T00:00:00Z",
    category: "runtime",
  }));
let promptVersions = seededPrompts();

/** The same checks and history insert as private.set_active_prompt (20261124000000). */
function setActivePrompt(key, version, action, user) {
  const rows = promptVersions.filter((row) => row.key === key);
  const target = rows.find((row) => row.version === version);
  if (!target) return `no prompt ${key} version ${version}`;
  if (target.active) return "already active";
  const current = rows.find((row) => row.active);
  if (action === "roll_back" && (!current || target.activated_at === null)) {
    return "roll back needs a version that was active before";
  }
  if (current) current.active = false;
  target.active = true;
  target.activated_at = new Date().toISOString();
  publishHistory.push({
    id: nextHistoryId++,
    kind: "prompt",
    item_key: key,
    version,
    action,
    acted_by: user.id,
    acted_by_email: user.email ?? null,
    acted_at: target.activated_at,
  });
  return null;
}

/** The same checks and history insert as private.set_published_story_card (20261123000000). */
function setPublishedCard(key, version, action, user) {
  const rows = cardVersions.filter((row) => row.key === key);
  const target = rows.find((row) => row.version === version);
  if (!target) return `no story card ${key} version ${version}`;
  if (target.published) return "already published";
  const current = rows.find((row) => row.published);
  if (action === "roll_back" && (!current || target.published_at === null)) {
    return "roll back needs a version that was published before";
  }
  if (current) current.published = false;
  target.published = true;
  target.published_at = new Date().toISOString();
  publishHistory.push({
    id: nextHistoryId++,
    kind: "story_card",
    item_key: key,
    version,
    action,
    acted_by: user.id,
    acted_by_email: user.email ?? null,
    acted_at: target.published_at,
  });
  return null;
}
/** A Companion's stories in order with their Life Path period number (private.story_periods). */
function storyPeriods(companionId) {
  const stories = contentRows.stories
    .filter((row) => row.companion_id === companionId)
    .sort((left, right) => left.sequence - right.sequence);
  let number = 0;
  return stories.map((story, index) => {
    if (index === 0 || stories[index - 1].period !== story.period) number += 1;
    return { story, number };
  });
}

const STORY_COLUMN = {
  title: "title",
  period: "period",
  goal: "goal_short",
  who: "who",
  opening: "opening",
  path: "path",
};

/** What a field key names and the text shown now (private.resolve_content_field), or null. */
function resolveField(key) {
  const own = String(key).match(
    /^chr\.([a-z]{2,8})\.(name|tags|who|period)(\.([1-9][0-9]{0,2}))?$/,
  );
  if (own) {
    const companion = contentRows.companions.find((row) => row.key_code === own[1]);
    if (!companion || (own[2] === "period") !== (own[4] !== undefined)) return null;
    if (own[2] !== "period")
      return { companion, story: null, field: own[2], current: companion[own[2]] };
    const period = Number(own[4]);
    const first = storyPeriods(companion.id).find((row) => row.number === period);
    return first
      ? { companion, story: null, field: "period", period, current: first.story.period }
      : null;
  }
  const storyKey = String(key).match(
    /^([a-z]{2,8})\.([a-z0-9][a-z0-9-]*)\.(title|period|goal|who|opening|path)$/,
  );
  if (!storyKey) return null;
  const companion = contentRows.companions.find((row) => row.key_code === storyKey[1]);
  const story = contentRows.stories.find(
    (row) => row.id === storyKey[2] && row.companion_id === companion?.id,
  );
  if (!companion || !story) return null;
  return { companion, story, field: storyKey[3], current: story[STORY_COLUMN[storyKey[3]]] };
}

/** The same checks, column write and history insert as private.set_published_content_field. */
function setPublishedField(target, key, version, action, user) {
  const rows = contentFields.filter((row) => row.key === key);
  const chosen = rows.find((row) => row.version === version);
  if (!chosen) return `no field ${key} version ${version}`;
  if (chosen.published) return "already published";
  const current = rows.find((row) => row.published);
  if (action === "roll_back" && (!current || chosen.published_at === null)) {
    return "roll back needs a version that was published before";
  }
  const periods = storyPeriods(target.companion.id);
  if (target.field === "period" && target.story) {
    const index = periods.findIndex((row) => row.story.id === target.story.id);
    const size = periods.filter((row) => row.number === periods[index].number).length;
    const neighbours = [periods[index - 1]?.story.period, periods[index + 1]?.story.period];
    if (chosen.body !== target.story.period && !(size > 1 && neighbours.includes(chosen.body))) {
      return "a story stays in its own period or moves to a neighbouring one";
    }
  }
  if (target.field === "period" && !target.story) {
    if (periods.some((row) => row.number !== target.period && row.story.period === chosen.body)) {
      return "another period already has this name";
    }
  }
  if (current) current.published = false;
  chosen.published = true;
  chosen.published_at = new Date().toISOString();
  if (!target.story && target.field === "period") {
    for (const row of periods) if (row.number === target.period) row.story.period = chosen.body;
  } else if (!target.story) target.companion[target.field] = chosen.body;
  else target.story[STORY_COLUMN[target.field]] = chosen.body;
  publishHistory.push({
    id: nextHistoryId++,
    kind: target.story ? "story_field" : "companion_field",
    item_key: key,
    version,
    action,
    acted_by: user.id,
    acted_by_email: user.email ?? null,
    acted_at: chosen.published_at,
  });
  return null;
}

/** The hotline list (#118) as after the migration: the seed entries as version 1, published. */
const seededHotlines = () =>
  JSON.parse(
    readFileSync(new URL("../../src/content/hotlines.json", import.meta.url), "utf8"),
  ).entries.map((entry) => ({
    country: entry.country,
    version: 1,
    service_name: entry.serviceName,
    primary_kind: entry.primary.kind,
    primary_value: entry.primary.value,
    secondary_kind: entry.secondary?.kind ?? null,
    secondary_value: entry.secondary?.value ?? null,
    note: entry.note,
    checked_on: entry.checkedOn,
    checked_by: entry.checkedBy,
    published: true,
    created_at: "2026-11-23T00:00:00Z",
    published_at: "2026-11-23T00:00:00Z",
  }));
let hotlines = seededHotlines();

/** The same checks and history insert as private.set_published_hotline (20261128000000). */
function setPublishedHotline(country, version, action, user, list = hotlines) {
  const rows = list.filter((row) => row.country === country);
  const target = rows.find((row) => row.version === version);
  if (!target) return `no hotline ${country} version ${version}`;
  if (target.published) return "already published";
  const current = rows.find((row) => row.published);
  if (action === "roll_back" && (!current || target.published_at === null)) {
    return "roll back needs a version that was published before";
  }
  if (current) current.published = false;
  target.published = true;
  target.published_at = new Date().toISOString();
  publishHistory.push({
    id: nextHistoryId++,
    kind: "hotline",
    item_key: country,
    version,
    action,
    acted_by: user.id,
    acted_by_email: user.email ?? null,
    acted_at: target.published_at,
  });
  return null;
}

/** The AI feature rows (#436) as after the migration and the seed script: every status exploring. */
const seededAiFeatures = () =>
  readFeatureSeed().map((row) => ({
    ...row,
    status: "exploring",
    created_at: "2026-11-25T00:00:00Z",
    sections_updated_at: null,
    sections_updated_by: null,
    // #473: the registry columns as 20261202000000_ai_registry.sql leaves the 7 rows.
    feature_id: RUNTIME_FEATURE_IDS[row.slug],
    category: "runtime",
    ...Object.fromEntries(REGISTRY_TEXT_FIELDS.map((field) => [field, ""])),
    example_text: "",
    example_state: "none",
    example_set_by: null,
    example_set_at: null,
    fields_updated_at: null,
    fields_updated_by: null,
  }));
let aiFeatures = seededAiFeatures();
let aiFeatureHistory = [];
let aiFeatureRuns = [];
/** #473: the field history and the example history (20261202000000_ai_registry.sql). */
let aiFeatureFieldHistory = [];
let aiFeatureExampleHistory = [];
let nextAiFeatureId = 1;

/**
 * #474: the registry as one account reads it (POST /__ai_features { token, registry: true }): the
 * 19 rows after the registry migration, the seed script and the prompt import, made from the
 * invented test fixtures of #473 (tests/fixtures/ai-registry/, never the owner's files): the 7
 * runtime rows with their registry fields filled and the 12 Pipeline and Quality gate rows. It has
 * one field history row and one example history row, so the detail page's history tables show.
 */
const REGISTRY_FIXTURES = new URL("../../tests/fixtures/ai-registry/", import.meta.url);
const REGISTRY_EDITOR = "00000000-0000-4000-8000-000000000474";
const registryFeatures = () => {
  const seed = readRegistrySeed(fileURLToPath(new URL("registry-seed.json", REGISTRY_FIXTURES)));
  const fields = (row) => ({
    ...Object.fromEntries(REGISTRY_TEXT_FIELDS.map((field) => [field, row[field] ?? ""])),
    example_text: row.example_text,
    example_state: row.example_state,
  });
  const runtime = seededAiFeatures().map((feature) => {
    const row = seed.find((item) => item.slug === feature.slug);
    return row ? { ...feature, ...fields(row) } : feature;
  });
  const added = seed
    .filter((row) => row.category !== "runtime")
    .map((row) => ({
      slug: row.slug,
      position: row.position,
      title: row.title,
      prompt_keys: [row.slug],
      purpose: [],
      pass_questions: [],
      approach: [],
      status: row.status,
      created_at: "2026-11-26T00:00:00Z",
      sections_updated_at: null,
      sections_updated_by: null,
      feature_id: row.feature_id,
      category: row.category,
      ...fields(row),
      example_set_by: null,
      example_set_at: null,
      fields_updated_at: null,
      fields_updated_by: null,
    }));
  return {
    features: [...runtime, ...added],
    history: [],
    fieldHistory: [
      {
        id: 474001,
        feature_slug: "pause_message",
        field: "requirement",
        old_value: "",
        new_value: "Invented requirement for R-03.",
        changed_by: REGISTRY_EDITOR,
        changed_at: "2026-11-20T10:00:00Z",
      },
    ],
    exampleHistory: [
      {
        id: 474002,
        feature_slug: "p02_select_stories",
        example_text: "Invented example for P-02.",
        example_state: "confirmed",
        set_by: REGISTRY_EDITOR,
        set_at: "2026-11-20T10:00:00Z",
      },
    ],
  };
};

/**
 * #474: the prompts as the registry account reads them: the seed prompts, the 12 Pipeline and
 * Quality gate prompts of the fixture folder (as scripts/ai-features/import-pipeline-prompts.mjs
 * imports them), and one fixed draft of stuck_story with one invented line, so the prompt panel
 * shows a draft and its changed lines. Read only, as the seeded view of #446.
 */
const registryPrompts = () => {
  const seeded = seededPrompts();
  const stuck = seeded.find((row) => row.key === "stuck_story");
  return [
    ...seeded,
    ...readPipelinePrompts(fileURLToPath(new URL("en", REGISTRY_FIXTURES))).map((row) => ({
      key: row.key,
      version: 1,
      active: true,
      body: row.body,
      params: {},
      note: row.note,
      created_at: "2026-11-26T00:00:00Z",
      activated_at: "2026-11-26T00:00:00Z",
      category: row.category,
    })),
    {
      ...stuck,
      version: 2,
      active: false,
      // The last line replaced: the changed lines show one removed and one added line.
      body: [
        ...stuck.body.replace(/\n+$/, "").split("\n").slice(0, -1),
        "An invented draft line for {{name}}.",
      ].join("\n"),
      note: "#474 registry view draft",
      created_at: "2026-11-26T10:00:00Z",
      activated_at: null,
    },
  ];
};

/**
 * #517: the R-08 registry row of rest_reply_review, as scripts/ai-features/rest-review-seed.mjs
 * inserts it, with two invented pass questions so a comparison can be saved.
 */
const storedVersionFeature = () => ({
  ...seededAiFeatures().find((row) => row.slug === "rest_reply"),
  slug: "rest_reply_review",
  position: 99,
  title: "Rest reply review (rest_reply_review)",
  prompt_keys: ["rest_reply_review"],
  purpose: [],
  pass_questions: [
    { text: "Invented question one for #517?", source: null, draft: false },
    { text: "Invented question two for #517?", source: null, draft: false },
  ],
  approach: [],
  feature_id: "R-08",
  category: "runtime",
});

/**
 * #517: stored versions beyond the published one and the draft: rest_reply v2 (active once, then
 * rolled back past, so not a draft), a rest_reply draft v3, and an inactive rest_reply_review v1
 * with invented text (the owner's texts are never in the repository).
 */
const storedVersionPrompts = () => {
  const rest = seededPrompts().find((row) => row.key === "rest_reply");
  const base = { note: "#517 stored version", category: "runtime" };
  return [
    {
      ...rest,
      ...base,
      version: 2,
      active: false,
      body: `${rest.body.replace(/\n+$/, "")}\nAn invented earlier line of v2.`,
      created_at: "2026-11-20T00:00:00Z",
      activated_at: "2026-11-20T00:00:00Z",
    },
    {
      ...rest,
      ...base,
      version: 3,
      active: false,
      body: `${rest.body.replace(/\n+$/, "")}\nAn invented draft line of v3.`,
      created_at: "2026-11-27T00:00:00Z",
      activated_at: null,
    },
    {
      ...base,
      key: "rest_reply_review",
      version: 1,
      active: false,
      body: [
        'Return JSON only: {"reply":"..."}',
        "An invented review prompt for the e2e tests.",
        "Facts already known: {{facts}}",
        "The person wrote: {{userMessage}}",
        "Draft: {{draft}}",
      ].join("\n"),
      params: rest.params,
      created_at: "2026-11-27T00:00:00Z",
      activated_at: null,
    },
  ];
};

/**
 * #453: the feature rows and status history an account reads and writes: its own copy when it has
 * one (POST /__ai_features { token, own: true }), otherwise the shared ones.
 */
const aiFeatureState = (account) =>
  account?.aiFeaturesOwn ?? {
    features: aiFeatures,
    history: aiFeatureHistory,
    fieldHistory: aiFeatureFieldHistory,
    exampleHistory: aiFeatureExampleHistory,
  };

/** #473: one field history row when a value changed (private.record_ai_feature_field). */
function recordAiFeatureField(state, slug, field, oldValue, newValue, user) {
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
  state.fieldHistory.push({
    id: nextAiFeatureId++,
    feature_slug: slug,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: user.id,
    changed_at: new Date().toISOString(),
  });
}

/** The item check of private.ai_feature_items_valid (20261130000000). */
const validItems = (items) =>
  Array.isArray(items) &&
  items.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.keys(item).every((key) => ["text", "source", "draft"].includes(key)) &&
      typeof item.text === "string" &&
      item.text.trim().length > 0 &&
      item.text.length <= 2000 &&
      "source" in item &&
      (item.source === null || (typeof item.source === "string" && item.source.length <= 300)) &&
      typeof item.draft === "boolean",
  );

/** While on, get_story_cards fails as when the database cannot answer (#300, FAIL-PREMADE). */
let storyCardsFailReads = false;

const port = Number(process.env.STUB_SUPABASE_PORT ?? process.env.E2E_SUPABASE_PORT ?? "3198");
/** token → { user, tables } */
const datasets = new Map();
/** #476: the prompt lab's runs and their steps, as start_ai_run and finish_ai_run write them. */
const aiRuns = [];
const aiRunSteps = [];

/** The shared app_text rows (#288): the seed loads every code default as version 1, published. */
function seededAppText() {
  return readAppTextSeed().map((entry) => ({
    key: entry.key,
    version: 1,
    body: entry.text,
    published: true,
    published_at: "2026-11-15T00:00:00Z",
    created_at: "2026-11-15T00:00:00Z",
    screen: entry.key.split(".")[1],
  }));
}
let appText = seededAppText();
let appTextFailReads = false;
/** The shared publish history (#289): { id, kind, item_key, version, action, acted_by, email, acted_at }. */
let publishHistory = [];
let nextHistoryId = 1;

/**
 * #447: the fixed publish history of POST /__publish_history { token, own: true }, as
 * list_publish_history answers it, newest first: the prototype's three rows (a Companion field,
 * a prompt, an app text). The first two are not published now, so an admin sees Roll back.
 */
const seededPublishHistory = () => [
  {
    id: 3,
    kind: "companion_field",
    item_key: "chr.opp.who",
    version: 2,
    action: "publish",
    acted_by: "00000000-0000-4000-8000-000000000447",
    acted_by_email: "editor@example.invalid",
    acted_at: "2026-11-14T15:20:00Z",
    is_current: false,
  },
  {
    id: 2,
    kind: "prompt",
    item_key: "step_cards",
    version: 4,
    action: "publish",
    acted_by: "00000000-0000-4000-8000-000000000447",
    acted_by_email: "editor@example.invalid",
    acted_at: "2026-11-12T10:04:00Z",
    is_current: false,
  },
  {
    id: 1,
    kind: "app_text",
    item_key: "ui.S1.back",
    version: 3,
    action: "publish",
    acted_by: "00000000-0000-4000-8000-000000000448",
    acted_by_email: "writer@example.invalid",
    acted_at: "2026-11-12T09:40:00Z",
    is_current: true,
  },
];

/** The same checks and history insert as private.set_published_app_text (20261118000000). */
function setPublished(key, version, action, user) {
  const rows = appText.filter((row) => row.key === key);
  const target = rows.find((row) => row.version === version);
  if (!target) return `no app text ${key} version ${version}`;
  if (target.published) return "already published";
  const current = rows.find((row) => row.published);
  if (action === "roll_back" && (!current || target.published_at === null)) {
    return "roll back needs a version that was published before";
  }
  if (current) current.published = false;
  target.published = true;
  target.published_at = new Date().toISOString();
  publishHistory.push({
    id: nextHistoryId++,
    kind: "app_text",
    item_key: key,
    version,
    action,
    acted_by: user.id,
    acted_by_email: user.email ?? null,
    acted_at: target.published_at,
  });
  return null;
}

const json = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(body === undefined ? "" : JSON.stringify(body));
};

const tokenOf = (request) => {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
};

/** The same deletes as public.delete_my_account(), for the caller's user id only. */
function deleteOwnRows(dataset) {
  const uid = dataset.user.id;
  const t = dataset.tables;
  const sessions = new Set(t.sessions.filter((row) => row.user_id === uid).map((row) => row.id));
  const goals = new Set(t.goals.filter((row) => row.user_id === uid).map((row) => row.id));
  t.session_lines = t.session_lines.filter((row) => !sessions.has(row.session_id));
  t.session_steps = t.session_steps.filter((row) => !sessions.has(row.session_id));
  t.sessions = t.sessions.filter((row) => row.user_id !== uid);
  t.steps = t.steps.filter((row) => !goals.has(row.goal_id));
  t.goals = t.goals.filter((row) => row.user_id !== uid);
  t.profiles = t.profiles.filter((row) => row.user_id !== uid);
  dataset.deleted = true;
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function parseList(value) {
  // in.(a,b) or in.("a","b")
  const inner = value.slice(1, -1);
  return inner.length === 0 ? [] : inner.split(",").map((item) => item.replace(/^"|"$/g, ""));
}

function matches(row, params) {
  for (const [column, condition] of params) {
    if (["select", "order", "limit", "offset", "columns"].includes(column)) continue;
    const dot = condition.indexOf(".");
    const op = condition.slice(0, dot);
    const value = condition.slice(dot + 1);
    const cell = row[column] === null || row[column] === undefined ? null : String(row[column]);
    if (op === "eq" && cell !== value) return false;
    if (op === "neq" && cell === value) return false;
    if (op === "is" && !(value === "null" ? cell === null : cell === value)) return false;
    if (op === "in" && !parseList(value).includes(cell)) return false;
  }
  return true;
}

function ordered(rows, order) {
  if (!order) return rows;
  const [column, direction = "asc", nulls] = order.split(",")[0].split(".");
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = left[column] ?? null;
    const b = right[column] ?? null;
    if (a === b) return 0;
    if (a === null) return nulls === "nullsfirst" ? -1 : 1;
    if (b === null) return nulls === "nullsfirst" ? 1 : -1;
    return a < b ? -sign : sign;
  });
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const path = url.pathname;

  if (path === "/health") return json(response, 200, { ok: true });

  if (path === "/__seed" && request.method === "POST") {
    const body = await readBody(request);
    if (!body?.token || !body.user?.id) return json(response, 400, { error: "token and user" });
    const tables = {
      profiles: [],
      goals: [],
      steps: [],
      sessions: [],
      session_steps: [],
      session_lines: [],
    };
    for (const [name, rows] of Object.entries(body.tables ?? {})) tables[name] = rows;
    datasets.set(body.token, {
      user: body.user,
      tables,
      deleted: false,
      missingFunctions: body.missingFunctions ?? [],
      contentRole: body.contentRole ?? null,
      researchCondition: body.researchCondition ?? null,
    });
    return json(response, 200, { ok: true });
  }

  if (path === "/__app_text" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (body.reset === true) {
      appText = seededAppText();
      publishHistory = [];
    } else if (typeof body.reset === "string") {
      const key = body.reset;
      appText = [
        ...appText.filter((row) => row.key !== key),
        ...seededAppText().filter((row) => row.key === key),
      ];
      publishHistory = publishHistory.filter((row) => row.item_key !== key);
    }
    if (typeof body.failReads === "boolean") appTextFailReads = body.failReads;
    return json(response, 200, { ok: true, failReads: appTextFailReads });
  }

  if (path === "/__tables") {
    const dataset = datasets.get(url.searchParams.get("token"));
    if (!dataset) return json(response, 404, {});
    return json(response, 200, {
      ...dataset.tables,
      auth_users: dataset.deleted ? [] : [dataset.user],
    });
  }

  const dataset = datasets.get(tokenOf(request));

  // #479: the sample library (e2e/support/stub-ai-samples.mjs).
  const ctx = { path, request, response, url, dataset, datasets, json, matches, ordered, readBody };
  if (await handleAiSamples(ctx)) return;
  // #477: an account's own run log (e2e/support/stub-ai-runs.mjs).
  if (await handleAiRuns({ ...ctx, promptReaderToken, aiFeatureState })) return;
  // #478: the comparison lab's saved answers (e2e/support/stub-ai-comparisons.mjs).
  if (await handleAiComparisons({ ...ctx, aiFeatureState })) return;

  // Sign out runs in the browser (another origin than the stub), so only this endpoint answers
  // cross-origin requests (#287: Sign out in the admin).
  if (path === "/auth/v1/logout") {
    response.setHeader("access-control-allow-origin", request.headers.origin ?? "*");
    response.setHeader(
      "access-control-allow-headers",
      request.headers["access-control-request-headers"] ?? "*",
    );
    response.setHeader("access-control-allow-methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") return json(response, 204);
    if (request.method === "POST") return json(response, 204);
  }

  if (path === "/auth/v1/user") {
    if (!dataset || dataset.deleted) return json(response, 401, { code: 401, msg: "invalid JWT" });
    // #118: "auth" in __fail_reads makes the auth server answer 500 (an outage, not a sign out).
    if ((dataset.failReads ?? []).includes("auth")) {
      return json(response, 500, { code: 500, msg: "auth unavailable (stub)" });
    }
    const { id, email } = dataset.user;
    return json(response, 200, {
      id,
      email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-11-01T00:00:00Z",
    });
  }

  if (path.startsWith("/auth/v1/")) return json(response, 400, { error: "not supported by stub" });

  if (path === "/rest/v1/rpc/get_active_prompts" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const allowed = promptReaderToken.length > 0 && body.reader_token === promptReaderToken;
    // #473: runtime keys only (AI-PROMPT-CATEGORY), as 20261202000000_ai_registry.sql.
    const active = promptVersions
      .filter((row) => row.active && row.category === "runtime")
      .map(({ key, version, body, params, note }) => ({ key, version, body, params, note }));
    return json(response, 200, allowed ? active : []);
  }

  if (path === "/__prompts" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (typeof body.token === "string" && "seededView" in body) {
      // #446: that account's list_prompt_versions answers the seeded prompts (version 1 of each,
      // no drafts), whatever other tests save meanwhile; null gives it up. Read only: a write from
      // the account is refused, so its view never mixes with the shared rows.
      const account = datasets.get(body.token);
      if (!account) return json(response, 404, { message: "no such account" });
      account.promptsSeededView = body.seededView === true ? true : undefined;
      return json(response, 200, { ok: true });
    }
    if (Array.isArray(body.importRows)) {
      // #473: as the SQL of scripts/ai-features/import-pipeline-prompts.mjs: version 1, active,
      // with its category, only when the key has no row yet.
      for (const row of body.importRows) {
        if (!/^[a-z][a-z0-9_]*$/.test(row?.key ?? "")) {
          return json(response, 400, { code: "23514", message: "bad key" });
        }
        if (!["runtime", "pipeline", "gate"].includes(row.category)) {
          return json(response, 400, { code: "23514", message: "bad category" });
        }
        if (promptVersions.some((item) => item.key === row.key)) continue;
        const now = new Date().toISOString();
        promptVersions.push({
          key: row.key,
          version: 1,
          active: true,
          body: String(row.body ?? ""),
          params: {},
          note: String(row.note ?? ""),
          created_at: now,
          activated_at: now,
          category: row.category,
        });
      }
      return json(response, 200, { ok: true });
    }
    if (body.reset === true) {
      promptVersions = seededPrompts();
      publishHistory = publishHistory.filter((row) => row.kind !== "prompt");
    } else if (typeof body.reset === "string") {
      // #439: one key only, so test files that use different prompts never undo each other.
      const key = body.reset;
      promptVersions = [
        ...promptVersions.filter((row) => row.key !== key),
        ...seededPrompts().filter((row) => row.key === key),
      ];
      publishHistory = publishHistory.filter(
        (row) => !(row.kind === "prompt" && row.item_key === key),
      );
    }
    return json(response, 204);
  }

  // #308: prompt versions and drafts (editors), publish and roll back (admin only).
  const promptRpc = path.match(
    /^\/rest\/v1\/rpc\/(list_prompt_versions|save_prompt_draft|publish_prompt|roll_back_prompt)$/,
  );
  if (promptRpc && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const role = dataset && !dataset.deleted ? dataset.contentRole : null;
    const needsAdmin = promptRpc[1] === "publish_prompt" || promptRpc[1] === "roll_back_prompt";
    if (needsAdmin ? role !== "admin" : !["admin", "writer"].includes(role)) {
      return json(response, 403, { code: "42501", message: "not allowed" });
    }
    if (
      promptRpc[1] !== "list_prompt_versions" &&
      (dataset.promptsSeededView || dataset.promptsRegistryView)
    ) {
      return json(response, 409, { message: "this account reads the seeded prompts only" });
    }
    if (promptRpc[1] === "list_prompt_versions") {
      const source = dataset.promptsRegistryView
        ? [...registryPrompts(), ...(dataset.promptsStoredVersions ? storedVersionPrompts() : [])]
        : dataset.promptsSeededView
          ? seededPrompts()
          : promptVersions;
      const rows = [...source].sort((left, right) =>
        left.key === right.key ? right.version - left.version : left.key < right.key ? -1 : 1,
      );
      return json(response, 200, rows);
    }
    if (promptRpc[1] === "save_prompt_draft") {
      const params = body.prompt_params;
      if (typeof params !== "object" || params === null || Array.isArray(params)) {
        return json(response, 400, { code: "22023", message: "settings must be an object" });
      }
      const rows = promptVersions.filter((row) => row.key === body.prompt_key);
      if (rows.length === 0) return json(response, 404, { code: "P0002", message: "no prompt" });
      const version = Math.max(...rows.map((row) => row.version)) + 1;
      promptVersions.push({
        key: body.prompt_key,
        version,
        active: false,
        body: body.prompt_body,
        params,
        note: body.prompt_note ?? "",
        created_at: new Date().toISOString(),
        activated_at: null,
        // #473: a new version keeps its key's category (private.keep_prompt_category).
        category: rows[0].category ?? "runtime",
      });
      return json(response, 200, version);
    }
    const action = promptRpc[1] === "publish_prompt" ? "publish" : "roll_back";
    const problem = setActivePrompt(body.prompt_key, body.prompt_version, action, dataset.user);
    return problem ? json(response, 400, { code: "P0001", message: problem }) : json(response, 204);
  }

  if (path === "/rest/v1/rpc/get_story_content" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const allowed = contentReadKey.length > 0 && body.reader_key === contentReadKey;
    return json(response, 200, allowed ? storyContentDocument() : null);
  }

  // #300: one story's pre-made cards for the server's reader key: the seed deck as version 1,
  // published; with versions, exactly the listed key and version pairs.
  if (path === "/rest/v1/rpc/get_story_cards" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (storyCardsFailReads) return json(response, 503, { message: "database unavailable" });
    if (!(contentReadKey.length > 0 && body.reader_key === contentReadKey)) {
      return json(response, 200, null);
    }
    const versions = body.versions ?? null;
    // As the migration: published cards, or exactly the pinned versions that were ever published.
    const cards = (deckOverrides.get(body.story) ?? cardVersions)
      .filter((card) => card.story_id === body.story)
      .filter((card) =>
        versions === null
          ? card.published
          : card.published_at !== null && versions[card.key] === card.version,
      )
      .map((card) => ({
        key: card.key,
        version: card.version,
        kind: card.kind,
        part: card.part,
        position: card.position,
        body: card.body,
      }));
    return json(response, 200, { cards });
  }

  if (path === "/__story_cards" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    // #516: a deck or restore call leaves the read switch of premade-cards.spec.ts as it is.
    if ("failReads" in body || body.reset === true || (!body.deck && !body.restore)) {
      storyCardsFailReads = body.failReads === true;
    }
    if (body.reset === true) {
      cardVersions = seededCardVersions();
      partTitles = storyCards.parts.map((part) => ({ ...part }));
      publishHistory = publishHistory.filter((row) => row.kind !== "story_card");
    }
    // #516 AC5: get_story_cards answers an invented deck for one story ({ deck: { story, cards } },
    // cards per part) until { restore: story }. Kept apart from the card rows, so another file's
    // { reset: true } does not undo it in the middle of a test.
    if (typeof body.deck?.story === "string" && Array.isArray(body.deck.cards)) {
      deckOverrides.set(body.deck.story, inventedDeckRows(body.deck.story, body.deck.cards));
    }
    if (typeof body.restore === "string") deckOverrides.delete(body.restore);
    // A published version 1 that differs from the seed, as when the database still holds a card
    // the seed has since fixed (#46): { published: { key, body } }.
    if (typeof body.published?.key === "string" && typeof body.published?.body === "string") {
      const row = cardVersions.find(
        (card) => card.key === body.published.key && card.version === 1,
      );
      if (row) row.body = body.published.body;
    }
    return json(response, 204);
  }

  // #304: card drafts and part titles (editors), publish and roll back (admin only).
  const cardRpc = path.match(
    /^\/rest\/v1\/rpc\/(save_story_card_draft|save_story_part_title|publish_story_card|roll_back_story_card)$/,
  );
  if (cardRpc && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const role = dataset && !dataset.deleted ? dataset.contentRole : null;
    const needsAdmin = cardRpc[1] === "publish_story_card" || cardRpc[1] === "roll_back_story_card";
    if (needsAdmin ? role !== "admin" : !["admin", "writer"].includes(role)) {
      return json(response, 403, { code: "42501", message: "not allowed" });
    }
    if (cardRpc[1] === "save_story_part_title") {
      const part = partTitles.find(
        (row) => row.story_id === body.story && row.part === body.part_number,
      );
      if (!part) return json(response, 404, { code: "P0002", message: "no such part" });
      part.title = body.part_title;
      return json(response, 204);
    }
    if (cardRpc[1] === "save_story_card_draft") {
      // #502: a card of the account's draft import is saved in its own rows.
      const pool = dataset.drafts?.story_cards.some((row) => row.key === body.card_key)
        ? dataset.drafts.story_cards
        : cardVersions;
      const rows = pool.filter((row) => row.key === body.card_key);
      if (rows.length === 0) return json(response, 404, { code: "P0002", message: "no card" });
      const newest = rows.reduce((left, right) => (right.version > left.version ? right : left));
      const version = newest.version + 1;
      pool.push({
        ...newest,
        version,
        body: body.card_body,
        published: false,
        published_at: null,
      });
      return json(response, 200, version);
    }
    const action = cardRpc[1] === "publish_story_card" ? "publish" : "roll_back";
    const problem = setPublishedCard(body.card_key, body.card_version, action, dataset.user);
    return problem ? json(response, 400, { code: "P0001", message: problem }) : json(response, 204);
  }

  if (path === "/__content_fields" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (body.reset === true) {
      contentRows = seededContentRows();
      contentFields = [];
      publishHistory = publishHistory.filter(
        (row) => row.kind !== "companion_field" && row.kind !== "story_field",
      );
    }
    return json(response, 204);
  }

  // #309: field drafts (editors), publish and roll back (admin only).
  const fieldRpc = path.match(
    /^\/rest\/v1\/rpc\/(save_content_field_draft|publish_content_field|roll_back_content_field)$/,
  );
  if (fieldRpc && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const role = dataset && !dataset.deleted ? dataset.contentRole : null;
    const needsAdmin = fieldRpc[1] !== "save_content_field_draft";
    if (needsAdmin ? role !== "admin" : !["admin", "writer"].includes(role)) {
      return json(response, 403, { code: "42501", message: "not allowed" });
    }
    const target = resolveField(body.field_key);
    if (!target) return json(response, 404, { code: "P0002", message: "no content field" });
    if (fieldRpc[1] === "save_content_field_draft") {
      const rows = contentFields.filter((row) => row.key === body.field_key);
      const base = { companion_id: target.companion.id, story_id: target.story?.id ?? null };
      if (rows.length === 0 && /\S/.test(target.current)) {
        contentFields.push({
          ...base,
          key: body.field_key,
          version: 1,
          body: target.current,
          published: true,
          published_at: new Date().toISOString(),
        });
      }
      const version =
        Math.max(
          0,
          ...contentFields.filter((row) => row.key === body.field_key).map((row) => row.version),
        ) + 1;
      contentFields.push({
        ...base,
        key: body.field_key,
        version,
        body: body.field_body,
        published: false,
        published_at: null,
      });
      return json(response, 200, version);
    }
    const action = fieldRpc[1] === "publish_content_field" ? "publish" : "roll_back";
    const problem = setPublishedField(
      target,
      body.field_key,
      body.field_version,
      action,
      dataset.user,
    );
    return problem ? json(response, 400, { code: "P0001", message: problem }) : json(response, 204);
  }

  if (path === "/rest/v1/rpc/research_condition" && request.method === "POST") {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    // "fail" stands for a read that fails (#114): the app must not open the focus page.
    if (dataset.researchCondition === "fail") {
      return json(response, 500, { code: "XX000", message: "stub failure" });
    }
    return json(response, 200, dataset.researchCondition ?? null);
  }

  // #518 (REST-ROUND-10): a Pause's round count, as 20261210000000_rest_rounds.sql: read 0 for
  // none or another account's session; record only the next round, refuse another account.
  if (
    (path === "/rest/v1/rpc/rest_round" || path === "/rest/v1/rpc/record_rest_round") &&
    request.method === "POST"
  ) {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    if ((dataset.failReads ?? []).includes("rest_rounds")) {
      return json(response, 500, { code: "XX000", message: "rest rounds failed (stub)" });
    }
    const body = (await readBody(request)) ?? {};
    const own = dataset.tables.sessions.some(
      (row) => row.id === body.target_session && row.user_id === dataset.user.id,
    );
    dataset.restRounds ??= new Map();
    const key = `${body.target_session}/${body.target_pause}`;
    const counted = own ? (dataset.restRounds.get(key) ?? 0) : 0;
    if (path === "/rest/v1/rpc/rest_round") return json(response, 200, counted);
    if (!own)
      return json(response, 403, { code: "42501", message: "not a session of this account" });
    const round = body.shown_round;
    if (!Number.isInteger(round) || round < 1 || round > 10) {
      return json(response, 400, { code: "22023", message: "a rest round is 1 to 10" });
    }
    if (round !== counted + 1) return json(response, 200, counted);
    dataset.restRounds.set(key, round);
    return json(response, 200, round);
  }

  if (path === "/rest/v1/rpc/content_role" && request.method === "POST") {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    return json(response, 200, dataset.contentRole);
  }

  // #293: stories are readable by signed-in accounts; story_parts and story_cards by content
  // editors only (other accounts get no rows, as the policies; anonymous requests are refused).
  const storyTable = path.match(
    /^\/rest\/v1\/(stories|story_parts|story_cards|companions|content_fields)$/,
  );
  if (storyTable && request.method === "GET") {
    const user = dataset && !dataset.deleted ? dataset : null;
    if (!user) return json(response, 401, { code: "42501", message: "permission denied" });
    const editor = ["admin", "writer"].includes(user.contentRole);
    const all = {
      stories: contentRows.stories,
      story_parts: partTitles,
      story_cards: cardVersions,
      companions: contentRows.companions,
      content_fields: contentFields,
    }[storyTable[1]];
    const open = storyTable[1] === "stories" || storyTable[1] === "companions";
    // #502: the account's own draft import, when loaded (the policies as for the seed rows).
    const own = user.drafts?.[storyTable[1]] ?? [];
    const visible = open || editor ? [...all, ...own] : [];
    const params = [...url.searchParams.entries()];
    const found = visible.filter((row) => matches(row, params));
    // #514: at most 1000 rows per request, from `offset` (supabase-js `range`), as the hosted API.
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? STORY_PAGE_ROWS),
      STORY_PAGE_ROWS,
    );
    const page = ordered(found, url.searchParams.get("order")).slice(offset, offset + limit);
    return json(response, 200, page);
  }

  // #502: this account reads the invented draft import too (e2e/support/stub-drafts.mjs).
  if (path === "/__drafts" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const target = datasets.get(body.token);
    if (!target) return json(response, 404, { error: "no such token" });
    target.drafts =
      body.load === true
        ? draftTables(Number(body.extraVersions ?? 0))
        : body.load === "oppenheimer"
          ? keptDraftTables(new Set(storyCards.cards.map((card) => card.key)))
          : undefined;
    return json(response, 200, { ok: true });
  }

  if (path === "/__fail_reads" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const target = datasets.get(body.token);
    if (!target) return json(response, 404, { error: "no such token" });
    target.failReads = Array.isArray(body.tables) ? body.tables : [];
    return json(response, 200, { ok: true });
  }

  if (path === "/__hotlines" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (typeof body.token === "string" && "own" in body) {
      // #448: the account's own copy of the seed list, or the shared list again with null.
      const account = datasets.get(body.token);
      if (!account) return json(response, 404, { message: "no such account" });
      if (![null, "seeded", "copy"].includes(body.own)) {
        return json(response, 400, { message: "own is seeded, copy or null" });
      }
      account.hotlinesOwn = body.own === null ? undefined : seededHotlines();
      account.hotlinesReadOnly = body.own === "seeded";
      return json(response, 200, { ok: true });
    }
    if (body.reset === true) {
      hotlines = seededHotlines();
      publishHistory = publishHistory.filter((row) => row.kind !== "hotline");
    }
    return json(response, 200, { ok: true });
  }

  if (path === "/rest/v1/hotlines" && request.method === "GET") {
    const user = dataset && !dataset.deleted ? dataset : null;
    if (!user) return json(response, 401, { code: "42501", message: "permission denied" });
    const editor = ["admin", "writer"].includes(user.contentRole);
    const params = [...url.searchParams.entries()];
    const source = user.hotlinesOwn ?? hotlines;
    const found = source.filter((row) => (editor || row.published) && matches(row, params));
    let rows = ordered(found, url.searchParams.get("order"));
    const limit = url.searchParams.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    return json(response, 200, rows);
  }

  const hotlineRpc = path.match(
    /^\/rest\/v1\/rpc\/(save_hotline_draft|publish_hotline|roll_back_hotline)$/,
  );
  if (hotlineRpc && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (!dataset || dataset.deleted || dataset.contentRole !== "admin") {
      return json(response, 403, { code: "42501", message: "only an admin may change a hotline" });
    }
    if (dataset.hotlinesReadOnly) {
      return json(response, 409, { message: "this account reads the seeded hotlines only" });
    }
    const list = dataset.hotlinesOwn ?? hotlines;
    if (hotlineRpc[1] === "save_hotline_draft") {
      const version =
        Math.max(
          0,
          ...list.filter((row) => row.country === body.entry_country).map((row) => row.version),
        ) + 1;
      list.push({
        country: body.entry_country,
        version,
        service_name: body.entry_service_name || null,
        primary_kind: body.entry_primary_kind,
        primary_value: body.entry_primary_value,
        secondary_kind: body.entry_secondary_kind ?? null,
        secondary_value: body.entry_secondary_value ?? null,
        note: body.entry_note || null,
        checked_on: body.entry_checked_on,
        checked_by: body.entry_checked_by,
        published: false,
        created_at: new Date().toISOString(),
        published_at: null,
      });
      return json(response, 200, version);
    }
    const action = hotlineRpc[1] === "publish_hotline" ? "publish" : "roll_back";
    const problem = setPublishedHotline(
      body.entry_country,
      body.entry_version,
      action,
      dataset.user,
      list,
    );
    return problem ? json(response, 400, { code: "P0001", message: problem }) : json(response, 204);
  }

  if (path === "/__publish_history" && request.method === "POST") {
    // #447: that account's list_publish_history answers the fixed rows of SEEDED_PUBLISH_HISTORY
    // (null gives the view up), so the visual gate never reads a row another test writes (#460).
    const body = (await readBody(request)) ?? {};
    const account = typeof body.token === "string" ? datasets.get(body.token) : undefined;
    if (account && body.append && typeof body.append === "object") {
      // #460: a publish row in the shared history, as an editing test's publish writes one.
      const { kind, item_key: itemKey, version } = body.append;
      publishHistory.push({
        id: nextHistoryId++,
        kind,
        item_key: itemKey,
        version,
        action: "publish",
        acted_by: account.user.id,
        acted_by_email: account.user.email ?? null,
        acted_at: new Date().toISOString(),
      });
      return json(response, 200, { ok: true });
    }
    if (account && typeof body.remove === "string") {
      // #460: takes that account's rows of one key out of the shared history again.
      publishHistory = publishHistory.filter(
        (row) => !(row.item_key === body.remove && row.acted_by === account.user.id),
      );
      return json(response, 200, { ok: true });
    }
    if (!account || !("own" in body)) return json(response, 404, { message: "no such account" });
    account.publishHistoryOwn = body.own === true ? seededPublishHistory() : undefined;
    return json(response, 200, { ok: true });
  }

  if (path === "/__ai_features" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (typeof body.token === "string" && "own" in body) {
      // #453: the account gets its own copy of the features and their status history (or gives it
      // up with null). Its reads, saves, status changes and the people lookup use the copy, so an
      // editing test never writes a row that another test or the visual gate reads.
      const account = datasets.get(body.token);
      if (!account) return json(response, 404, { message: "no such account" });
      account.aiFeaturesOwn =
        body.own === true
          ? { features: seededAiFeatures(), history: [], fieldHistory: [], exampleHistory: [] }
          : undefined;
      return json(response, 200, { ok: true });
    }
    if (typeof body.token === "string" && "registry" in body) {
      // #474: the account reads its own copy of the registry (19 rows from the test fixtures,
      // registryFeatures) and the prompts with the 12 imported keys and one fixed draft
      // (registryPrompts), or gives both up with null. Its prompt writes are refused, so the
      // visual gate never reads a row another test writes.
      const account = datasets.get(body.token);
      if (!account) return json(response, 404, { message: "no such account" });
      const on = body.registry === true;
      const stored = on && body.storedVersions === true;
      const registry = on ? registryFeatures() : undefined;
      if (registry && stored) registry.features.push(storedVersionFeature());
      account.aiFeaturesOwn = registry;
      account.promptsRegistryView = on ? true : undefined;
      account.promptsStoredVersions = stored ? true : undefined;
      return json(response, 200, { ok: true });
    }
    if (typeof body.token === "string" && "purpose" in body) {
      const account = datasets.get(body.token);
      if (!account) return json(response, 404, { message: "no such account" });
      const purpose = body.purpose ?? null;
      if (purpose !== null && !Object.values(purpose).every(validItems)) {
        return json(response, 400, { code: "23514", message: "violates check constraint" });
      }
      account.aiFeaturePurpose = purpose;
      return json(response, 200, { ok: true });
    }
    if (body.reset === true) {
      aiFeatures = seededAiFeatures();
      aiFeatureHistory = [];
      aiFeatureRuns = [];
      aiFeatureFieldHistory = [];
      aiFeatureExampleHistory = [];
    }
    for (const row of Array.isArray(body.testRuns) ? body.testRuns : []) {
      if (!aiFeatures.some((feature) => feature.slug === row.feature_slug)) {
        return json(response, 400, { code: "23503", message: `no AI feature ${row.feature_slug}` });
      }
      if (!["fake_model", "real"].includes(row.kind)) {
        return json(response, 400, { code: "23514", message: "kind is fake_model or real" });
      }
      aiFeatureRuns.push({
        id: nextAiFeatureId++,
        prompt_version: null,
        imported_at: new Date().toISOString(),
        ...row,
      });
    }
    return json(response, 200, { ok: true });
  }

  // #436: content editors read the three AI feature tables; other accounts get no rows.
  const aiFeatureTable = path.match(
    /^\/rest\/v1\/(ai_features|ai_feature_status_history|ai_feature_test_runs|ai_feature_field_history|ai_feature_example_history)$/,
  );
  if (aiFeatureTable && request.method === "GET") {
    const user = dataset && !dataset.deleted ? dataset : null;
    if (!user) return json(response, 401, { code: "42501", message: "permission denied" });
    // #474: POST /__fail_reads { token, tables: ["ai_features"] } makes this read fail.
    if ((user.failReads ?? []).includes(aiFeatureTable[1])) {
      return json(response, 500, { message: "stub read failure" });
    }
    const editor = ["admin", "writer"].includes(user.contentRole);
    // The account's own purpose items (POST /__ai_features { token, purpose }), if any.
    const purpose = user.aiFeaturePurpose ?? {};
    const state = aiFeatureState(user);
    const all = {
      ai_features: state.features.map((row) =>
        purpose[row.slug] ? { ...row, purpose: purpose[row.slug] } : row,
      ),
      ai_feature_status_history: state.history,
      ai_feature_test_runs: aiFeatureRuns,
      ai_feature_field_history: state.fieldHistory,
      ai_feature_example_history: state.exampleHistory,
    }[aiFeatureTable[1]];
    const params = [...url.searchParams.entries()];
    const found = (editor ? all : []).filter((row) => matches(row, params));
    let rows = ordered(found, url.searchParams.get("order"));
    const limit = url.searchParams.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    return json(response, 200, rows);
  }

  // #476: the prompt lab's run log, as 20261203000000_ai_runs.sql. start_ai_run (status running,
  // before the model call) and finish_ai_run (ok or error, by the account that started it, once)
  // need the server's prompt reader token and a content editor; content editors read every run
  // and step; ai_run_spend sums the costs between two times by account.
  const runWrite = path.match(/^\/rest\/v1\/rpc\/(start_ai_run|finish_ai_run)$/);
  if (runWrite && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    const tokenOk = promptReaderToken.length > 0 && body.server_token === promptReaderToken;
    if (!tokenOk || !editor) {
      return json(response, 403, { code: "42501", message: "not allowed" });
    }
    if (runWrite[1] === "start_ai_run") {
      const run = body.run ?? {};
      const features = aiFeatureState(dataset).features;
      if (!features.some((row) => row.slug === run.feature_slug)) {
        return json(response, 409, { code: "23503", message: "unknown feature" });
      }
      if (typeof run.stub !== "boolean") {
        return json(response, 400, { code: "23502", message: "bad run" });
      }
      const id = randomUUID();
      const fields = [
        "feature_slug",
        "prompt_key",
        "prompt_source",
        "prompt_version",
        "pasted_text",
        "sample_id",
        "model",
        "input",
        "stub",
      ];
      aiRuns.push({
        id,
        run_by: dataset.user.id,
        run_at: new Date().toISOString(),
        finished_at: null,
        ...Object.fromEntries(fields.map((name) => [name, run[name] ?? null])),
        output: null,
        input_tokens: null,
        output_tokens: null,
        cost: null,
        status: "running",
        error_reason: null,
      });
      return json(response, 200, id);
    }
    const result = body.result ?? {};
    if (!["ok", "error"].includes(result.status)) {
      return json(response, 400, { code: "22023", message: "a run ends as ok or error" });
    }
    const row = aiRuns.find(
      (item) =>
        item.id === body.run_id && item.run_by === dataset.user.id && item.status === "running",
    );
    if (!row) return json(response, 404, { code: "P0002", message: "no running run" });
    for (const name of ["output", "input_tokens", "output_tokens", "cost", "status"]) {
      row[name] = result[name] ?? null;
    }
    row.error_reason = result.error_reason ?? null;
    row.finished_at = new Date().toISOString();
    const steps = Array.isArray(result.steps) ? result.steps : [];
    for (const step of steps) aiRunSteps.push({ run_id: row.id, ...step });
    return json(response, 204);
  }

  if (path === "/rest/v1/rpc/ai_run_spend" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) return json(response, 403, { code: "42501", message: "not allowed" });
    const from = Date.parse(body.from_time);
    const to = Date.parse(body.to_time);
    const byUser = new Map();
    for (const run of aiRuns) {
      const at = Date.parse(run.run_at);
      if (!(at >= from && at < to)) continue;
      const row = byUser.get(run.run_by) ?? {
        user_id: run.run_by,
        email:
          [...datasets.values()].find((item) => item.user?.id === run.run_by)?.user?.email ?? null,
        runs: 0,
        unpriced_runs: 0,
        running_runs: 0,
        cost: 0,
      };
      row.runs += 1;
      if (run.status === "running") row.running_runs += 1;
      if (run.cost === null || run.cost === undefined) row.unpriced_runs += 1;
      else row.cost += Number(run.cost);
      byUser.set(run.run_by, row);
    }
    return json(
      response,
      200,
      [...byUser.values()].sort((a, b) => b.cost - a.cost),
    );
  }

  const aiRunTable = path.match(/^\/rest\/v1\/(ai_runs|ai_run_steps)$/);
  if (aiRunTable && request.method === "GET") {
    const user = dataset && !dataset.deleted ? dataset : null;
    if (!user) return json(response, 401, { code: "42501", message: "permission denied" });
    const editor = ["admin", "writer"].includes(user.contentRole);
    const all = aiRunTable[1] === "ai_runs" ? aiRuns : aiRunSteps;
    const params = [...url.searchParams.entries()];
    const rows = ordered(
      (editor ? all : []).filter((row) => matches(row, params)),
      url.searchParams.get("order"),
    );
    return json(response, 200, rows);
  }

  if (path === "/rest/v1/rpc/save_ai_feature_sections" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, {
        code: "42501",
        message: "only a content editor may change an AI feature",
      });
    }
    const feature = aiFeatureState(dataset).features.find(
      (row) => row.slug === body.target_feature,
    );
    if (!feature) {
      return json(response, 400, {
        code: "P0002",
        message: `no AI feature ${body.target_feature}`,
      });
    }
    const sections = [body.new_purpose, body.new_pass_questions, body.new_approach];
    if (!sections.every(validItems)) {
      return json(response, 400, { code: "23514", message: "violates check constraint" });
    }
    const state = aiFeatureState(dataset);
    for (const [field, value] of [
      ["purpose", body.new_purpose],
      ["pass_questions", body.new_pass_questions],
      ["approach", body.new_approach],
    ]) {
      recordAiFeatureField(state, feature.slug, field, feature[field], value, dataset.user);
    }
    feature.purpose = body.new_purpose;
    feature.pass_questions = body.new_pass_questions;
    feature.approach = body.new_approach;
    feature.sections_updated_at = new Date().toISOString();
    feature.sections_updated_by = dataset.user.id;
    return json(response, 204);
  }

  // #475: the name and fields in one save, and who changed them (e2e/support/stub-ai-registry-editing.mjs).
  if (
    await registryEditingRoute({
      path,
      request,
      response,
      dataset,
      datasets,
      state: aiFeatureState(dataset),
      readBody,
      json,
      record: recordAiFeatureField,
      textFields: REGISTRY_TEXT_FIELDS,
      fieldMax: REGISTRY_FIELD_MAX,
    })
  ) {
    return;
  }

  // #473: the registry fields (editors), the example (editors) and the category (admin only).
  if (path === "/rest/v1/rpc/save_ai_feature_fields" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, {
        code: "42501",
        message: "only a content editor may change an AI feature",
      });
    }
    const values = REGISTRY_TEXT_FIELDS.map((field) => body[`new_${field}`]);
    if (!values.every((value) => typeof value === "string")) {
      return json(response, 400, {
        code: "22004",
        message: "a registry field is text, never null",
      });
    }
    if (values.some((value, index) => value.length > REGISTRY_FIELD_MAX[index])) {
      return json(response, 400, { code: "23514", message: "violates check constraint" });
    }
    const state = aiFeatureState(dataset);
    const feature = state.features.find((row) => row.slug === body.target_feature);
    if (!feature) {
      return json(response, 400, {
        code: "P0002",
        message: `no AI feature ${body.target_feature}`,
      });
    }
    REGISTRY_TEXT_FIELDS.forEach((field, index) => {
      recordAiFeatureField(state, feature.slug, field, feature[field], values[index], dataset.user);
      feature[field] = values[index];
    });
    feature.fields_updated_at = new Date().toISOString();
    feature.fields_updated_by = dataset.user.id;
    return json(response, 204);
  }

  if (path === "/rest/v1/rpc/set_ai_feature_example" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, {
        code: "42501",
        message: "only a content editor may change an AI feature",
      });
    }
    if (!["none", "candidate", "confirmed"].includes(body.new_state)) {
      return json(response, 400, { code: "22023", message: "unknown example state" });
    }
    if (typeof body.new_text !== "string") {
      return json(response, 400, { code: "22004", message: "an example is text, never null" });
    }
    if (body.new_state !== "none" && body.new_text.trim() === "") {
      // ai_features_example_needs_text: a state other than none needs an example.
      return json(response, 400, { code: "22023", message: "an example state needs text" });
    }
    if (body.new_text.length > 8000) {
      return json(response, 400, { code: "23514", message: "violates check constraint" });
    }
    const state = aiFeatureState(dataset);
    const feature = state.features.find((row) => row.slug === body.target_feature);
    if (!feature) {
      return json(response, 400, {
        code: "P0002",
        message: `no AI feature ${body.target_feature}`,
      });
    }
    const now = new Date().toISOString();
    Object.assign(feature, {
      example_text: body.new_text,
      example_state: body.new_state,
      example_set_by: dataset.user.id,
      example_set_at: now,
    });
    state.exampleHistory.push({
      id: nextAiFeatureId++,
      feature_slug: feature.slug,
      example_text: body.new_text,
      example_state: body.new_state,
      set_by: dataset.user.id,
      set_at: now,
    });
    return json(response, 204);
  }

  if (path === "/rest/v1/rpc/set_ai_feature_category" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (!dataset || dataset.deleted || dataset.contentRole !== "admin") {
      return json(response, 403, {
        code: "42501",
        message: "only an admin may change the category of an AI feature",
      });
    }
    if (!["pipeline", "gate", "runtime"].includes(body.new_category)) {
      return json(response, 400, {
        code: "22023",
        message: `unknown category ${body.new_category}`,
      });
    }
    const state = aiFeatureState(dataset);
    const feature = state.features.find((row) => row.slug === body.target_feature);
    if (!feature) {
      return json(response, 400, {
        code: "P0002",
        message: `no AI feature ${body.target_feature}`,
      });
    }
    if (feature.category === body.new_category) {
      return json(response, 400, { code: "P0001", message: `already ${body.new_category}` });
    }
    recordAiFeatureField(
      state,
      feature.slug,
      "category",
      feature.category,
      body.new_category,
      dataset.user,
    );
    feature.category = body.new_category;
    return json(response, 204);
  }

  if (path === "/rest/v1/rpc/list_ai_feature_people" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, {
        code: "42501",
        message: "only a content editor may read who changed an AI feature",
      });
    }
    const state = aiFeatureState(dataset);
    const feature = state.features.find((row) => row.slug === body.target_feature);
    const ids = new Set(
      [
        ...state.history
          .filter((row) => row.feature_slug === body.target_feature)
          .map((row) => row.changed_by),
        feature?.sections_updated_by,
      ].filter(Boolean),
    );
    // auth.users: each seeded account that is not deleted, once.
    const found = new Map();
    for (const item of datasets.values()) {
      if (!item.deleted && ids.has(item.user.id)) found.set(item.user.id, item.user.email ?? null);
    }
    return json(
      response,
      200,
      [...found].map(([user_id, email]) => ({ user_id, email })),
    );
  }

  if (path === "/rest/v1/rpc/set_ai_feature_status" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (!dataset || dataset.deleted || dataset.contentRole !== "admin") {
      return json(response, 403, {
        code: "42501",
        message: "only an admin may change the status of an AI feature",
      });
    }
    if (!STATUSES.includes(body.new_status)) {
      return json(response, 400, { code: "22023", message: `unknown status ${body.new_status}` });
    }
    const state = aiFeatureState(dataset);
    const feature = state.features.find((row) => row.slug === body.target_feature);
    if (!feature) {
      return json(response, 400, {
        code: "P0002",
        message: `no AI feature ${body.target_feature}`,
      });
    }
    if (feature.status === body.new_status) {
      return json(response, 400, { code: "P0001", message: `already ${body.new_status}` });
    }
    const note = typeof body.change_note === "string" ? body.change_note.trim() : "";
    state.history.push({
      id: nextAiFeatureId++,
      feature_slug: feature.slug,
      from_status: feature.status,
      to_status: body.new_status,
      note: note || null,
      changed_by: dataset.user.id,
      changed_at: new Date().toISOString(),
    });
    feature.status = body.new_status;
    return json(response, 204);
  }

  if (path === "/rest/v1/app_text" && request.method === "GET") {
    const user = dataset && !dataset.deleted ? dataset : null;
    if (!user && appTextFailReads) return json(response, 503, { message: "database unavailable" });
    const editor = user?.contentRole === "admin" || user?.contentRole === "writer";
    const params = [...url.searchParams.entries()];
    const found = appText.filter((row) => (editor || row.published) && matches(row, params));
    return json(response, 200, ordered(found, url.searchParams.get("order")));
  }

  const appTextRpc = path.match(
    /^\/rest\/v1\/rpc\/(save_app_text_draft|publish_app_text|roll_back_app_text)$/,
  );
  if (appTextRpc && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, { code: "42501", message: "only a content editor may do this" });
    }
    if (appTextRpc[1] === "save_app_text_draft") {
      const version =
        Math.max(
          0,
          ...appText.filter((row) => row.key === body.text_key).map((row) => row.version),
        ) + 1;
      appText.push({
        key: body.text_key,
        version,
        body: body.text_body,
        published: false,
        published_at: null,
        created_at: new Date().toISOString(),
        screen: String(body.text_key).split(".")[1],
      });
      return json(response, 200, version);
    }
    const action = appTextRpc[1] === "publish_app_text" ? "publish" : "roll_back";
    const problem = setPublished(body.text_key, body.text_version, action, dataset.user);
    return problem ? json(response, 400, { code: "P0001", message: problem }) : json(response, 204);
  }

  if (path === "/rest/v1/rpc/list_publish_history" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const editor = dataset && !dataset.deleted && ["admin", "writer"].includes(dataset.contentRole);
    if (!editor) {
      return json(response, 403, {
        code: "42501",
        message: "only a content editor may read the publish history",
      });
    }
    const limit = Math.min(Math.max(Number(body.row_limit ?? 100) || 100, 1), 500);
    // #447: an account with the fixed view (POST /__publish_history) reads only those rows.
    if (dataset.publishHistoryOwn) return json(response, 200, dataset.publishHistoryOwn);
    const rows = [...publishHistory]
      .sort((left, right) => right.id - left.id)
      .slice(0, limit)
      .map((row) => ({
        ...row,
        is_current:
          row.kind === "hotline"
            ? hotlines.some(
                (line) =>
                  line.country === row.item_key && line.version === row.version && line.published,
              )
            : row.kind === "prompt"
              ? promptVersions.some(
                  (prompt) =>
                    prompt.key === row.item_key && prompt.version === row.version && prompt.active,
                )
              : (row.kind === "story_card"
                  ? cardVersions
                  : row.kind === "companion_field" || row.kind === "story_field"
                    ? contentFields
                    : appText
                ).some(
                  (text) =>
                    text.key === row.item_key && text.version === row.version && text.published,
                ),
      }));
    return json(response, 200, rows);
  }

  if (path === "/rest/v1/rpc/delete_my_account" && request.method === "POST") {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    if (dataset.missingFunctions.includes("delete_my_account")) {
      return json(response, 404, { code: "PGRST202", message: "function not found" });
    }
    deleteOwnRows(dataset);
    return json(response, 204);
  }

  if (path.startsWith("/rest/v1/")) {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    const table = path.slice("/rest/v1/".length);
    const rows = dataset.tables[table];
    if (!rows) return json(response, 404, { message: `no table ${table}` });
    const params = [...url.searchParams.entries()];
    const hit = (row) => matches(row, params);

    if (request.method === "GET" || request.method === "HEAD") {
      if ((dataset.failReads ?? []).includes(table)) {
        return json(response, 500, { code: "XX000", message: "read failed (stub)" });
      }
      let found = ordered(rows.filter(hit), url.searchParams.get("order"));
      const offset = Number(url.searchParams.get("offset") ?? "0");
      if (offset > 0) found = found.slice(offset);
      const limit = url.searchParams.get("limit");
      if (limit) found = found.slice(0, Number(limit));
      if ((request.headers.accept ?? "").includes("vnd.pgrst.object")) {
        if (found.length !== 1) {
          return json(response, 406, { code: "PGRST116", message: "not one row" });
        }
        return json(response, 200, found[0]);
      }
      return json(response, 200, found);
    }

    if (request.method === "PATCH") {
      const patch = (await readBody(request)) ?? {};
      const changed = [];
      for (const row of rows) {
        if (!hit(row)) continue;
        Object.assign(row, patch);
        changed.push(row);
      }
      const minimal = (request.headers.prefer ?? "").includes("return=minimal");
      return minimal ? json(response, 204) : json(response, 200, changed);
    }

    // #521: delete with the same filters (Start on /goal replaces a Goal's Steps: delete, then
    // insert), so a whole account run can start from the goal dialogue.
    if (request.method === "DELETE") {
      const kept = rows.filter((row) => !hit(row));
      rows.splice(0, rows.length, ...kept);
      return json(response, 204);
    }

    // Insert and upsert, as PostgREST takes them from supabase-js (#27: the signed-in focus page
    // and the summary write the account's progress). An upsert merges into the row with the same
    // `on_conflict` columns (default `id`); a plain insert of an existing row is a 409.
    if (request.method === "POST") {
      const body = (await readBody(request)) ?? [];
      const incoming = Array.isArray(body) ? body : [body];
      const prefer = request.headers.prefer ?? "";
      const merge = prefer.includes("resolution=merge-duplicates");
      const ignore = prefer.includes("resolution=ignore-duplicates");
      const keys = (url.searchParams.get("on_conflict") ?? "id").split(",");
      const same = (left, right) => keys.every((key) => String(left[key]) === String(right[key]));
      const written = [];
      for (const row of incoming) {
        const existing = rows.find((item) => same(item, row));
        if (existing && merge) {
          Object.assign(existing, row);
          written.push(existing);
        } else if (existing && ignore) {
          continue;
        } else if (existing) {
          return json(response, 409, { code: "23505", message: "duplicate key value" });
        } else {
          const added = { ...row };
          // #521: as the database's default (gen_random_uuid()), for Steps the app inserts unnamed.
          if (table === "steps" && added.id === undefined) added.id = randomUUID();
          rows.push(added);
          written.push(added);
        }
      }
      const minimal = !prefer.includes("return=representation");
      return minimal ? json(response, 201) : json(response, 201, written);
    }

    return json(response, 405, { message: "method not supported by stub" });
  }

  json(response, 404, { message: "not found" });
}).listen(port, "127.0.0.1");
