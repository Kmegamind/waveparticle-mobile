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
//   POST /rest/v1/rpc/get_active_prompts  { reader_token } → the seed prompts in docs/ai/prompts
//        when the token is STUB_PROMPTS_READ_TOKEN, otherwise no rows, as the real function (#282)
//   POST /rest/v1/rpc/get_story_content  { reader_key } → the seed story content (src/content,
//        docs/demo) when the key is STUB_CONTENT_READ_KEY, otherwise null, as the real function (#284)
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

const promptDirectory = fileURLToPath(new URL("../../docs/ai/prompts", import.meta.url));
const promptReaderToken = process.env.STUB_PROMPTS_READ_TOKEN ?? "";
const contentReadKey = process.env.STUB_CONTENT_READ_KEY ?? "";
/** The story content, as get_story_content returns it once the import has run (#284). */
const storyContent = appDocument(readContentRows());

const port = Number(process.env.STUB_SUPABASE_PORT ?? "3198");
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
    return json(response, 200, allowed ? readPromptDirectory(promptDirectory) : []);
  }

  if (path === "/rest/v1/rpc/get_story_content" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const allowed = contentReadKey.length > 0 && body.reader_key === contentReadKey;
    return json(response, 200, allowed ? storyContent : null);
  }

  if (path === "/rest/v1/rpc/content_role" && request.method === "POST") {
    if (!dataset || dataset.deleted) return json(response, 401, { message: "JWT required" });
    return json(response, 200, dataset.contentRole);
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
        is_current: appText.some(
          (text) => text.key === row.item_key && text.version === row.version && text.published,
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

    return json(response, 405, { message: "method not supported by stub" });
  }

  json(response, 404, { message: "not found" });
}).listen(port, "127.0.0.1");
