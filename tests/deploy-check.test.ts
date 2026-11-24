import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  TABLES_QUERY,
  checkSite,
  compareTables,
  expectedTables,
  readLiveTables,
} from "../scripts/deploy-check.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationsDir = path.join(root, "supabase/migrations");
const migrationTexts = () =>
  readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => readFileSync(path.join(migrationsDir, n), "utf8"));

type FakeAnswer = { status: number; location?: string };
function fakeFetch(answers: Record<string, FakeAnswer | "down">) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const answer = answers[new URL(url).pathname];
    if (!answer || answer === "down") throw new TypeError("fetch failed");
    const headers = new Headers(answer.location ? { location: answer.location } : {});
    return new Response(null, { status: answer.status, headers });
  };
  return { impl, calls };
}

describe("#189 AC5: tables and row-level security expected from the migrations", () => {
  it("reads create, drop, rename and row-level security statements in order", () => {
    const tables = expectedTables([
      "create table public.a (id int); -- create table public.commented (id int);\n",
      "create table if not exists public.b (id int);\nalter table public.b enable row level security;",
      'create table "public"."c" (id int); alter table only public.c enable row level security;',
      "create table public.d (id int); drop table public.d;",
      "create table public.e (id int); alter table public.e rename to f;",
      "create table private.p (id int); create table auth.ignored (id int);",
      "/* create table public.block (id int); */ alter table public.a disable row level security;",
    ]);
    expect(Object.fromEntries(tables)).toEqual({
      "public.a": { rls: false },
      "public.b": { rls: true },
      "public.c": { rls: true },
      "public.f": { rls: false },
      "private.p": { rls: false },
    });
  });

  it("finds every table of the repository's migrations, with row-level security on every public one", () => {
    const tables = expectedTables(migrationTexts());
    expect(tables.get("public.goals")).toEqual({ rls: true });
    expect(tables.get("public.hotlines")).toEqual({ rls: true });
    expect(tables.has("private.prompt_reader")).toBe(true);
    for (const [name, { rls }] of tables)
      if (name.startsWith("public.")) expect(rls, name).toBe(true);
  });

  it("says in one sentence which table is missing and where row-level security is off", () => {
    const expected = expectedTables([
      "create table public.goals (id int); alter table public.goals enable row level security;" +
        "create table public.hotlines (id int); alter table public.hotlines enable row level security;" +
        "create table private.reader (id int);",
    ]);
    const errors = compareTables(expected, [
      { schema: "public", name: "goals", rls: false },
      { schema: "private", name: "reader", rls: false },
    ]);
    expect(errors).toEqual([
      expect.stringMatching(
        /^Row-level security is off on public\.goals, but the migrations turn it on\./,
      ),
      expect.stringMatching(/^The database has no table public\.hotlines\./),
    ]);
    expect(
      compareTables(expected, [
        { schema: "public", name: "goals", rls: true },
        { schema: "public", name: "hotlines", rls: true },
        { schema: "private", name: "reader", rls: false },
      ]),
    ).toEqual([]);
  });
});

describe("#189 AC5: website checks", () => {
  const base = "http://127.0.0.1:9";

  it("passes a signed-out home page that redirects to sign-in", async () => {
    const { impl, calls } = fakeFetch({
      "/": { status: 307, location: "/auth/sign-in" },
      "/auth/sign-in": { status: 200 },
    });
    const results = await checkSite(base, impl);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(calls[0].init).toMatchObject({ redirect: "manual" });
  });

  it("accepts an absolute redirect with a query string", async () => {
    const { impl } = fakeFetch({
      "/": { status: 302, location: `${base}/auth/sign-in?next=%2F` },
      "/auth/sign-in": { status: 200 },
    });
    expect((await checkSite(base, impl)).every((r) => r.ok)).toBe(true);
  });

  it("fails with a plain sentence when the site answers 5xx", async () => {
    const { impl } = fakeFetch({ "/": { status: 500 }, "/auth/sign-in": { status: 503 } });
    const failed = (await checkSite(base, impl)).filter((r) => !r.ok).map((r) => r.message);
    expect(failed).toEqual([
      "The site returned 500 on the home page. Look at the Vercel runtime logs and check the environment variables (docs/HUMAN_STEPS.md).",
      "The site returned 503 on the sign-in page. Look at the Vercel runtime logs and check the environment variables (docs/HUMAN_STEPS.md).",
    ]);
  });

  it("fails when the signed-out home page does not redirect to sign-in", async () => {
    const shown = fakeFetch({ "/": { status: 200 }, "/auth/sign-in": { status: 200 } });
    expect((await checkSite(base, shown.impl)).find((r) => !r.ok)?.message).toMatch(
      /should redirect to \/auth\/sign-in, but the site answered 200\./,
    );
    const elsewhere = fakeFetch({
      "/": { status: 307, location: "/welcome" },
      "/auth/sign-in": { status: 200 },
    });
    expect((await checkSite(base, elsewhere.impl)).find((r) => !r.ok)?.message).toMatch(
      /answered 307 with a redirect to \/welcome/,
    );
  });

  it("fails when the site cannot be reached", async () => {
    const { impl } = fakeFetch({ "/": "down" });
    const [result] = await checkSite(base, impl);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not be reached/);
  });
});

describe("#189 AC5: reading the live tables", () => {
  it("posts the read query with the token and returns the rows", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const rows = [{ schema: "public", name: "goals", rls: true }];
    const impl = async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json(rows, { status: 201 });
    };
    expect(
      await readLiveTables({ ref: "abc", token: "t0k", apiUrl: "http://127.0.0.1:1/" }, impl),
    ).toEqual(rows);
    expect(seen!.url).toBe("http://127.0.0.1:1/v1/projects/abc/database/query");
    expect(seen!.init.method).toBe("POST");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer t0k");
    expect(JSON.parse(String(seen!.init.body))).toEqual({ query: TABLES_QUERY });
    expect(TABLES_QUERY).toMatch(/^select /);
  });

  it("explains a refused token without printing it or the answer", async () => {
    const impl = async () => new Response("secret body", { status: 401 });
    const error = await readLiveTables({ ref: "abc", token: "t0k" }, impl).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/refused SUPABASE_ACCESS_TOKEN \(status 401\)/);
    expect((error as Error).message).not.toMatch(/t0k|secret body/);
  });
});

describe("#189 AC5: npm run check:deploy against local stand-ins", () => {
  const servers: Server[] = [];
  afterEach(() => servers.splice(0).forEach((s) => s.close()));

  async function serve(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<string> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function run(env: Record<string, string>, args: string[] = []) {
    return new Promise<{ code: number | null; out: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        [path.join(root, "scripts/check-deploy.mjs"), ...args],
        {
          env: { PATH: process.env.PATH ?? "", ...env },
        },
      );
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code, out }));
    });
  }

  const site = (homeStatus = 307) =>
    serve((req, res) => {
      if (req.url === "/" && homeStatus === 307)
        res.writeHead(307, { location: "/auth/sign-in" }).end();
      else res.writeHead(req.url === "/" ? homeStatus : 200).end("page");
    });

  const allTables = () =>
    [...expectedTables(migrationTexts())].map(([key, { rls }]) => {
      const [schema, name] = key.split(".");
      return { schema, name, rls };
    });

  const api = (rows: object[], seen: string[] = []) =>
    serve((req, res) => {
      seen.push(`${req.method} ${req.url} ${req.headers.authorization}`);
      res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify(rows));
    });

  it("passes against a healthy local site and database", async () => {
    const seen: string[] = [];
    const [siteUrl, apiUrl] = [await site(), await api(allTables(), seen)];
    const { code, out } = await run({
      E2E_BASE_URL: siteUrl,
      SUPABASE_PROJECT_REF: "localref",
      SUPABASE_ACCESS_TOKEN: "local-token-123",
      SUPABASE_API_URL: apiUrl,
    });
    expect(out).not.toMatch(/FAIL/);
    expect(out).toMatch(/OK: the database has all \d+ tables/);
    expect(out).not.toContain("local-token-123");
    expect(seen).toEqual(["POST /v1/projects/localref/database/query Bearer local-token-123"]);
    expect(code).toBe(0);
  });

  it("fails with one sentence per problem: 5xx and a missing table", async () => {
    const rows = allTables().filter((r) => r.name !== "hotlines");
    const [siteUrl, apiUrl] = [await site(500), await api(rows)];
    const { code, out } = await run({
      E2E_BASE_URL: siteUrl,
      SUPABASE_PROJECT_REF: "localref",
      SUPABASE_ACCESS_TOKEN: "local-token-123",
      SUPABASE_API_URL: apiUrl,
    });
    expect(out).toContain("FAIL: The site returned 500 on the home page.");
    expect(out).toContain("FAIL: The database has no table public.hotlines.");
    expect(code).toBe(1);
  });

  it("fails when the database settings are missing, and passes the website alone with --skip-db", async () => {
    const siteUrl = await site();
    const missing = await run({ E2E_BASE_URL: siteUrl });
    expect(missing.out).toMatch(
      /FAIL: the database was not checked: SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are not set/,
    );
    expect(missing.code).toBe(1);
    const skipped = await run({ E2E_BASE_URL: siteUrl }, ["--skip-db"]);
    expect(skipped.out).toContain("SKIPPED: database (--skip-db).");
    expect(skipped.code).toBe(0);
  });

  it("fails without E2E_BASE_URL and never sends the token to a stand-in off this machine", async () => {
    const { code, out } = await run({
      SUPABASE_PROJECT_REF: "localref",
      SUPABASE_ACCESS_TOKEN: "local-token-123",
      SUPABASE_API_URL: "https://example.com",
    });
    expect(out).toMatch(/FAIL: E2E_BASE_URL is not set/);
    expect(out).toMatch(/FAIL: SUPABASE_API_URL may only point at this machine/);
    expect(code).toBe(1);
  });
});
