// Test-only stand-in for the Supabase endpoints the Goals area calls, for the e2e run (#73).
// Never imported by the app: the e2e app's NEXT_PUBLIC_SUPABASE_URL points here.
//
// Each test signs in with its own access token, so parallel tests never share data:
//   POST /__seed   { token, user: { id, email }, tables: { profiles, goals, steps, sessions,
//                  session_steps, session_lines }, missingFunctions?: ["delete_my_account"] }
//   GET  /__tables?token=…   the dataset after the app's writes, with auth_users ([] once deleted)
//   GET  /health
//   GET  /auth/v1/user                (Authorization: Bearer <token>)
//   GET|PATCH /rest/v1/<table>?…      eq., in.(…), order, limit, select (all columns returned)
//   POST /rest/v1/rpc/get_active_prompts  { reader_token } → the seed prompts in docs/ai/prompts
//        when the token is STUB_PROMPTS_READ_TOKEN, otherwise no rows, as the real function (#282)
//   POST /rest/v1/rpc/delete_my_account   mirrors the migration (#103): the caller's rows, then
//                                          the auth user
//   POST /auth/v1/logout              204
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { readPromptDirectory } from "../../scripts/prompts/prompt-files.mjs";

const promptDirectory = fileURLToPath(new URL("../../docs/ai/prompts", import.meta.url));
const promptReaderToken = process.env.STUB_PROMPTS_READ_TOKEN ?? "";

const port = Number(process.env.STUB_SUPABASE_PORT ?? "3198");
/** token → { user, tables } */
const datasets = new Map();

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
    });
    return json(response, 200, { ok: true });
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

  if (path === "/auth/v1/logout" && request.method === "POST") return json(response, 204);

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
