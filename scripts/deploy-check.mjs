// The post-deploy check (#189): pure functions with an injected fetch. The CLI is
// scripts/check-deploy.mjs (`npm run check:deploy`). Results are plain sentences; no function
// returns a key, a token or a response body.

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const SCHEMAS = ["public", "private"];

export const TABLES_QUERY = `select n.nspname as schema, c.relname as name, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in (${SCHEMAS.map((s) => `'${s}'`).join(", ")})`;

const ident = String.raw`"?([a-z_][a-z0-9_]*)"?`;
const qualified = String.raw`(?:${ident}\.)?${ident}`;

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/**
 * The tables the migrations leave behind, as a Map of "schema.table" to { rls }, where rls is
 * true when a migration turned row-level security on. Migration texts are read in the order
 * given (the file name order). Tables in schemas other than public and private are ignored.
 */
export function expectedTables(migrationTexts) {
  const tables = new Map();
  const statements = migrationTexts.flatMap((sql) => stripSqlComments(sql).split(";"));
  const key = (schema, name) => `${(schema ?? "public").toLowerCase()}.${name.toLowerCase()}`;
  for (const raw of statements) {
    const s = raw.replace(/\s+/g, " ").trim().toLowerCase();
    let m;
    if ((m = s.match(new RegExp(`^create (?:unlogged )?table (?:if not exists )?${qualified}`)))) {
      const k = key(m[1], m[2]);
      if (!tables.has(k)) tables.set(k, { rls: false });
    } else if ((m = s.match(new RegExp(`^drop table (?:if exists )?${qualified}`)))) {
      tables.delete(key(m[1], m[2]));
    } else if (
      (m = s.match(
        new RegExp(`^alter table (?:if exists )?(?:only )?${qualified} rename to ${ident}$`),
      ))
    ) {
      const from = key(m[1], m[2]);
      if (tables.has(from)) {
        tables.set(key(m[1], m[3]), tables.get(from));
        tables.delete(from);
      }
    } else if (
      (m = s.match(
        new RegExp(
          `^alter table (?:if exists )?(?:only )?${qualified} (enable|disable) row level security`,
        ),
      ))
    ) {
      const k = key(m[1], m[2]);
      if (tables.has(k)) tables.get(k).rls = m[3] === "enable";
    }
  }
  for (const k of [...tables.keys()]) {
    if (!SCHEMAS.includes(k.split(".")[0])) tables.delete(k);
  }
  return tables;
}

/** Compares the expected tables with the rows of TABLES_QUERY. Returns plain sentences. */
export function compareTables(expected, rows) {
  const live = new Map(
    rows.map((row) => [`${row.schema}.${row.name}`, row.rls === true || row.rls === "t"]),
  );
  const errors = [];
  for (const [name, { rls }] of [...expected].sort(([a], [b]) => a.localeCompare(b))) {
    if (!live.has(name)) {
      errors.push(
        `The database has no table ${name}. A migration that creates it has not been applied: see docs/HUMAN_STEPS.md, Apply migrations.`,
      );
    } else if (rls && !live.get(name)) {
      errors.push(
        `Row-level security is off on ${name}, but the migrations turn it on. Anyone with the public key may read it: apply the missing migration or run "alter table ${name} enable row level security;" in the SQL editor.`,
      );
    }
  }
  return errors;
}

function siteUrl(base, path) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

/**
 * Website checks against a deployment: the home page and the sign-in page do not answer 5xx,
 * and a signed-out visit to the home page redirects to /auth/sign-in.
 * Returns [{ name, ok, message }].
 */
export async function checkSite(baseUrl, fetchImpl = fetch) {
  const results = [];
  let home;
  try {
    home = await fetchImpl(siteUrl(baseUrl, "/"), { redirect: "manual" });
  } catch {
    return [
      {
        name: "home page",
        ok: false,
        message: `The site at ${baseUrl} could not be reached. Check the address in E2E_BASE_URL and that the deployment finished.`,
      },
    ];
  }
  if (home.status >= 500) {
    results.push({
      name: "home page",
      ok: false,
      message: `The site returned ${home.status} on the home page. Look at the Vercel runtime logs and check the environment variables (docs/HUMAN_STEPS.md).`,
    });
  } else {
    results.push({ name: "home page", ok: true, message: `the home page answered ${home.status}` });
  }

  const location = home.headers.get("location");
  let target = null;
  try {
    target = location ? new URL(location, siteUrl(baseUrl, "/")).pathname : null;
  } catch {
    target = null;
  }
  if (REDIRECTS.has(home.status) && target === "/auth/sign-in") {
    results.push({
      name: "signed-out redirect",
      ok: true,
      message: "a signed-out visit to the home page goes to /auth/sign-in",
    });
  } else if (home.status < 500) {
    results.push({
      name: "signed-out redirect",
      ok: false,
      message: `A signed-out visit to the home page should redirect to /auth/sign-in, but the site answered ${home.status}${target ? ` with a redirect to ${target}` : ""}. Signed-out visitors may see pages they should not.`,
    });
  }

  try {
    const signIn = await fetchImpl(siteUrl(baseUrl, "/auth/sign-in"), { redirect: "manual" });
    results.push(
      signIn.status >= 500
        ? {
            name: "sign-in page",
            ok: false,
            message: `The site returned ${signIn.status} on the sign-in page. Look at the Vercel runtime logs and check the environment variables (docs/HUMAN_STEPS.md).`,
          }
        : { name: "sign-in page", ok: true, message: `the sign-in page answered ${signIn.status}` },
    );
  } catch {
    results.push({
      name: "sign-in page",
      ok: false,
      message: `The sign-in page at ${baseUrl} could not be reached.`,
    });
  }
  return results;
}

/**
 * Reads the live tables through the Supabase Management API (read-only query). Throws an Error
 * with a plain sentence; never includes the token or the response body.
 */
export async function readLiveTables(
  { ref, token, apiUrl = "https://api.supabase.com" },
  fetchImpl = fetch,
) {
  let response;
  try {
    response = await fetchImpl(
      `${apiUrl.replace(/\/$/, "")}/v1/projects/${encodeURIComponent(ref)}/database/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: TABLES_QUERY }),
      },
    );
  } catch {
    throw new Error(
      "The Supabase Management API could not be reached, so the tables were not checked.",
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `The Supabase Management API refused SUPABASE_ACCESS_TOKEN (status ${response.status}). Make a new personal access token (docs/HUMAN_STEPS.md, Run the post-deploy check).`,
    );
  }
  if (response.status === 404) {
    throw new Error(
      "The Supabase Management API does not know the project in SUPABASE_PROJECT_REF (status 404).",
    );
  }
  if (!response.ok) {
    throw new Error(
      `The Supabase Management API answered ${response.status}, so the tables were not checked.`,
    );
  }
  let rows;
  try {
    rows = await response.json();
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows)) {
    throw new Error(
      "The Supabase Management API answered in an unexpected shape, so the tables were not checked.",
    );
  }
  return rows;
}
