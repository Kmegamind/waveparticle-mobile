// Test-only stand-in for the Supabase endpoints the Goals area calls, for the e2e run (#73).
// Never imported by the app: the e2e app's NEXT_PUBLIC_SUPABASE_URL points here.
//
// Each test signs in with its own access token, so parallel tests never share data:
//   POST /__seed   { token, user: { id, email }, tables: { profiles, goals, steps, sessions,
//                  session_steps, session_lines }, missingFunctions?: ["delete_my_account"],
//                  contentRole?: "admin" | "writer" }
//   GET  /__tables?token=…   the dataset after the app's writes, with auth_users ([] once deleted)
//   GET  /health
//   GET  /auth/v1/user                (Authorization: Bearer <token>)
//   GET|PATCH /rest/v1/<table>?…      eq., in.(…), order, limit, select (all columns returned)
//   POST /rest/v1/<table>             insert, or upsert with Prefer: resolution=merge-duplicates
//                                     or ignore-duplicates on `on_conflict` (default id) (#27)
//   POST /rest/v1/rpc/get_active_prompts  { reader_token } → the active prompts (the seed in
//        docs/ai/prompts as version 1, then as published in ADM-08) when the token is
//        STUB_PROMPTS_READ_TOKEN, otherwise no rows, as the real function (#282)
//   POST /rest/v1/rpc/list_prompt_versions (editors), save_prompt_draft (editors),
//        publish_prompt | roll_back_prompt (admin only), as 20261124000000 (#308);
//        POST /__prompts { reset: true } puts the prompts and their history back
//   POST /rest/v1/rpc/get_story_content  { reader_key } → the seed story content (src/content,
//        docs/demo) when the key is STUB_CONTENT_READ_KEY, otherwise null, as the real function (#284)
//   GET  /rest/v1/stories | story_parts | story_cards   the seed rows (#293): stories for any
//                                     signed-in account, parts and cards for content editors only
//   POST /rest/v1/rpc/get_story_cards  { reader_key, story, versions } → the seed deck's cards as
//        version 1, published (#300), then as edited (#304); POST /__story_cards { failReads }
//        makes it fail, { reset: true } puts the cards, part titles and their history back
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
//   POST /__app_text  { failReads?: boolean, reset?: true | "<key>" }   published reads without a
//                                     user session answer 503 while failReads is on (database
//                                     down); reset puts every key (true) or one key back to the
//                                     seed and removes the matching history rows
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { readPromptDirectory } from "../../scripts/prompts/prompt-files.mjs";
import { readAppTextSeed } from "../../scripts/app-text/import.mjs";
import { appDocument, readContentRows } from "../../scripts/content/content-files.mjs";
import { readStoryDecks, storyCardRows } from "../../scripts/story-cards/import.mjs";

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
const storyContentDocument = () =>
  appDocument({
    ...contentRows,
    companions: contentRows.companions.map((row) => without(row, "who")),
    stories: contentRows.stories.map((row) => without(row, "path")),
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

/** While on, get_story_cards fails as when the database cannot answer (#300, FAIL-PREMADE). */
let storyCardsFailReads = false;

const port = Number(process.env.STUB_SUPABASE_PORT ?? process.env.E2E_SUPABASE_PORT ?? "3198");
/** token → { user, tables } */
const datasets = new Map();

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
    const active = promptVersions
      .filter((row) => row.active)
      .map(({ key, version, body, params, note }) => ({ key, version, body, params, note }));
    return json(response, 200, allowed ? active : []);
  }

  if (path === "/__prompts" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    if (body.reset === true) {
      promptVersions = seededPrompts();
      publishHistory = publishHistory.filter((row) => row.kind !== "prompt");
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
    if (promptRpc[1] === "list_prompt_versions") {
      const rows = [...promptVersions].sort((left, right) =>
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
    const cards = cardVersions
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
    storyCardsFailReads = body.failReads === true;
    if (body.reset === true) {
      cardVersions = seededCardVersions();
      partTitles = storyCards.parts.map((part) => ({ ...part }));
      publishHistory = publishHistory.filter((row) => row.kind !== "story_card");
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
      const rows = cardVersions.filter((row) => row.key === body.card_key);
      if (rows.length === 0) return json(response, 404, { code: "P0002", message: "no card" });
      const newest = rows.reduce((left, right) => (right.version > left.version ? right : left));
      const version = newest.version + 1;
      cardVersions.push({
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
    const visible = open || editor ? all : [];
    const params = [...url.searchParams.entries()];
    const found = visible.filter((row) => matches(row, params));
    return json(response, 200, ordered(found, url.searchParams.get("order")));
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
    const rows = [...publishHistory]
      .sort((left, right) => right.id - left.id)
      .slice(0, limit)
      .map((row) => ({
        ...row,
        is_current:
          row.kind === "prompt"
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
