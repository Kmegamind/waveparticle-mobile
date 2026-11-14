import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import { createMemoryProgressStore, type ProgressSession } from "@/lib/progress/account-progress";
import { finishAccountRun } from "@/lib/summary/finish-run";
import { createMemoryRunWriter, createSupabaseRunWriter } from "@/lib/summary/run-writer";

// Issue #258, final review: saving the lines is safe against a second tab and a write that fails
// halfway, and it touches only this session's rows.

const USER = "user-1";
const SESSION = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const NOW = "2026-11-13T12:00:00.000Z";

const completed: ProgressSession = {
  id: SESSION,
  goalId: "g1",
  companionId: "oppenheimer",
  storyId: "bohr-difficulties",
  state: "completed",
  backgroundCard: null,
  backgroundCardSource: null,
  mergedKeyMoments: [],
  closingLine: null,
  steps: [{ id: "ss0", stepId: "s0", position: 0, openedAt: NOW, doneAt: NOW }],
  lines: [],
};

async function setup() {
  const store = createMemoryProgressStore();
  await store.write(USER, {
    userId: USER,
    goals: [
      {
        id: "g1",
        title: "Goal",
        text: "Goal",
        status: "done",
        steps: [{ id: "s0", position: 0, title: "Outline", description: null, minutes: 10 }],
      },
    ],
    sessions: [completed],
  });
  return store;
}

function slowGateway(lines: { closingLine: string; carryLine: string }[]) {
  let call = 0;
  const writeClosingLine = vi.fn(async () => {
    const pair = lines[Math.min(call, lines.length - 1)];
    call += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { source: "generated" as const, ...pair };
  });
  return { gateway: { writeClosingLine } as unknown as ModelGateway, writeClosingLine };
}

const input = { sessionId: SESSION };

describe("#258 review I1: a second tab during the call never mixes two runs' lines", () => {
  it("both tabs show the lines that were saved, and one closing row exists", async () => {
    const store = await setup();
    const writer = createMemoryRunWriter(store, USER);
    const { gateway } = slowGateway([
      { closingLine: "I sent it off.", carryLine: "I wonder about Born." },
      { closingLine: "I kept it a day longer.", carryLine: "I doubt the method." },
    ]);
    const deps = { userId: USER, store, writer, gateway, nowIso: NOW };
    const [first, second] = await Promise.all([
      finishAccountRun(input, deps),
      finishAccountRun(input, deps),
    ]);
    expect(first).toEqual(second);
    const saved = (await store.read(USER, USER)).sessions[0];
    expect(saved.lines.filter((line) => line.kind === "closing")).toHaveLength(1);
    expect(first).toMatchObject({
      status: "ok",
      shown: { closingLine: saved.closingLine, carryLine: saved.lines[0].text },
    });
  });
});

describe("#258 review I2: a write that fails halfway can be retried", () => {
  it("a retry after the carried line failed to save shows the closing line, never a new one", async () => {
    const store = await setup();
    const writer = createMemoryRunWriter(store, USER);
    const insert = writer.insertClosingLine;
    writer.insertClosingLine = vi.fn(async () => {
      throw new Error("network");
    });
    const { gateway, writeClosingLine } = slowGateway([
      { closingLine: "I sent it off.", carryLine: "I wonder about Born." },
    ]);
    const deps = { userId: USER, store, writer, gateway, nowIso: NOW, wait: async () => undefined };
    expect(await finishAccountRun(input, deps)).toEqual({ status: "failed" });
    writer.insertClosingLine = insert;
    expect(await finishAccountRun(input, deps)).toEqual({
      status: "ok",
      shown: { closingLine: "I sent it off.", carryLine: "", next: "tolman-lecture" },
    });
    expect(writeClosingLine).toHaveBeenCalledTimes(1);
  });
});

describe("#258 review I3: the Supabase writer touches only this session's rows", () => {
  function fakeClient(claimed: boolean) {
    const calls: { table: string; op: string; rows?: unknown; filters?: unknown[] }[] = [];
    const from = (table: string) => ({
      update: (rows: unknown) => {
        const filters: unknown[] = [];
        const chain = {
          eq: (column: string, value: string) => (filters.push(["eq", column, value]), chain),
          is: (column: string, value: null) => (filters.push(["is", column, value]), chain),
          select: (columns: string) => {
            calls.push({ table, op: "update", rows, filters: [...filters, ["select", columns]] });
            return Promise.resolve({ data: claimed ? [{ id: SESSION }] : [], error: null });
          },
        };
        return chain;
      },
      upsert: (rows: unknown, options: unknown) => {
        calls.push({ table, op: "upsert", rows, filters: [options] });
        return Promise.resolve({ data: [], error: null });
      },
    });
    return { client: { from }, calls };
  }

  it("claims the closing line only when the session has none yet", async () => {
    const { client, calls } = fakeClient(true);
    expect(await createSupabaseRunWriter(client).claimClosingLine(SESSION, "I sent it off.")).toBe(
      "claimed",
    );
    expect(calls).toEqual([
      {
        table: "sessions",
        op: "update",
        rows: { closing_line: "I sent it off." },
        filters: [
          ["eq", "id", SESSION],
          ["eq", "state", "completed"],
          ["is", "closing_line", null],
          ["select", "id"],
        ],
      },
    ]);
  });

  it("reports a line another tab claimed first", async () => {
    const { client } = fakeClient(false);
    expect(await createSupabaseRunWriter(client).claimClosingLine(SESSION, "x")).toBe("taken");
  });

  it("writes the carried line once, ignoring a duplicate on retry", async () => {
    const { client, calls } = fakeClient(true);
    await createSupabaseRunWriter(client).insertClosingLine(SESSION, {
      id: "b",
      sessionStepId: null,
      seq: 0,
      kind: "closing",
      cardId: null,
      source: "generated",
      text: "I wonder.",
      pauseNumber: null,
      shownAt: NOW,
    });
    expect(calls.map((call) => [call.table, call.op, call.filters])).toEqual([
      ["session_lines", "upsert", [{ onConflict: "id", ignoreDuplicates: true }]],
    ]);
  });
});
