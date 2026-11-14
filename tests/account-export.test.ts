import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportFileName, readAccountExport } from "@/lib/account/export";

// #103 AC1: "Export my data" produces a readable file of the user's own Goals, Steps and history.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const NOW = new Date("2026-11-14T10:00:00Z");
const USER = { id: "u1", email: "ada@example.test" };

type Call = { table: string; filters: [string, string, unknown][] };

/** A fake client that records each table read and answers from `data`. */
function fakeClient(data: Record<string, Record<string, unknown>[]>, failOn?: string) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, filters: [] };
    calls.push(call);
    const query = {
      select: () => query,
      eq: (column: string, value: string) => (call.filters.push(["eq", column, value]), query),
      in: (column: string, values: string[]) => (call.filters.push(["in", column, values]), query),
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve(
          failOn === table
            ? { data: null, error: { message: "boom" } }
            : { data: data[table] ?? [], error: null },
        ).then(resolve),
    };
    return query;
  };
  return { client: { from } as never, calls };
}

describe("#103 AC1 the export file", () => {
  it("reads each of the six tables with the user's own filter", async () => {
    const { client, calls } = fakeClient({
      profiles: [{ user_id: "u1", nickname: "Ada" }],
      goals: [{ id: "g1", user_id: "u1", title: "Lab report" }],
      steps: [{ id: "s1", goal_id: "g1", title: "Outline" }],
      sessions: [{ id: "x1", user_id: "u1", goal_id: "g1" }],
      session_steps: [{ id: "ss1", session_id: "x1" }],
      session_lines: [{ id: "l1", session_id: "x1", text: "The desert is quiet." }],
    });
    const file = await readAccountExport(client, USER, NOW);
    expect(file).toEqual({
      exportedAt: "2026-11-14T10:00:00.000Z",
      account: { id: "u1", email: "ada@example.test" },
      profile: { user_id: "u1", nickname: "Ada" },
      goals: [{ id: "g1", user_id: "u1", title: "Lab report" }],
      steps: [{ id: "s1", goal_id: "g1", title: "Outline" }],
      sessions: [{ id: "x1", user_id: "u1", goal_id: "g1" }],
      sessionSteps: [{ id: "ss1", session_id: "x1" }],
      sessionLines: [{ id: "l1", session_id: "x1", text: "The desert is quiet." }],
    });
    const filterOf = (table: string) => calls.find((call) => call.table === table)?.filters;
    expect(filterOf("profiles")).toEqual([["eq", "user_id", "u1"]]);
    expect(filterOf("goals")).toEqual([["eq", "user_id", "u1"]]);
    expect(filterOf("sessions")).toEqual([["eq", "user_id", "u1"]]);
    expect(filterOf("steps")).toEqual([["in", "goal_id", ["g1"]]]);
    expect(filterOf("session_steps")).toEqual([["in", "session_id", ["x1"]]]);
    expect(filterOf("session_lines")).toEqual([["in", "session_id", ["x1"]]]);
  });

  it("gives a valid file with empty lists for a new account, without asking by empty ids", async () => {
    const { client, calls } = fakeClient({});
    const file = await readAccountExport(client, { id: "u1", email: null }, NOW);
    expect(file).toMatchObject({
      profile: null,
      goals: [],
      steps: [],
      sessions: [],
      sessionSteps: [],
      sessionLines: [],
    });
    expect(calls.map((call) => call.table).sort()).toEqual(["goals", "profiles", "sessions"]);
  });

  it("asks by at most 100 ids at a time", async () => {
    const goals = Array.from({ length: 230 }, (_, index) => ({ id: `g${index}`, user_id: "u1" }));
    const { client, calls } = fakeClient({ goals });
    await readAccountExport(client, USER, NOW);
    const sizes = calls
      .filter((call) => call.table === "steps")
      .map((call) => (call.filters[0][2] as string[]).length);
    expect(sizes).toEqual([100, 100, 30]);
  });

  it("fails instead of giving a partial file when a read fails", async () => {
    const { client } = fakeClient({ goals: [{ id: "g1", user_id: "u1" }] }, "steps");
    await expect(readAccountExport(client, USER, NOW)).rejects.toThrow("export read failed");
  });

  it("names the file after the day", () => {
    expect(exportFileName(NOW)).toBe("waveparticle-data-2026-11-14.json");
  });
});

describe("#103 AC1 the download route", () => {
  const route = read("src/app/me/export/download/route.ts");

  it("refuses a signed-out request and sends only the caller's own data", () => {
    expect(route).toContain("getCurrentUser(");
    expect(route).toMatch(/status:\s*401/);
    expect(route).toContain("readAccountExport(client, ");
  });

  it("is a readable JSON attachment that is never cached", () => {
    expect(route).toContain("application/json");
    expect(route).toContain("attachment; filename=");
    expect(route).toContain("no-store");
    expect(route).toContain("JSON.stringify(file, null, 2)");
  });
});
