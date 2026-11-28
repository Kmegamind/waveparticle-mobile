import { beforeEach, describe, expect, it, vi } from "vitest";
import { keywordOnlySafetyCheck } from "@/lib/safety/check";
import { seedContent } from "./support/seed-content";

// #114, fix round 1 (I2): the four server actions that would reach the model or his cards are
// called with the research flag on, off and failing. A spy gateway counts every call made on it:
// with the flag on, or when the flag cannot be read, nothing reaches it.

type Flag = "on" | "off" | "failing";

const state = vi.hoisted(() => ({
  flag: "off" as "on" | "off" | "failing",
  gatewayCalls: [] as string[],
  gatewaysMade: 0,
  tableReads: [] as string[],
}));

/** A query chain that answers nothing (the session read finds no row). */
function emptyQuery(): unknown {
  const answer = { data: null, error: null };
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(answer),
    maybeSingle: async () => answer,
  };
  for (const name of ["select", "eq", "is", "in", "update"]) chain[name] = () => chain;
  return chain;
}

const client = {
  rpc: async (fn: string) => {
    // #518: the rest reply reads the Pause's round count first (none yet: round 1).
    if (fn === "rest_round") return { data: 0, error: null };
    if (fn !== "research_condition") return { data: null, error: null };
    if (state.flag === "failing") return { data: null, error: { code: "500" } };
    return { data: state.flag === "on" ? "no_story" : null, error: null };
  },
  from: (table: string) => {
    state.tableReads.push(table);
    return emptyQuery();
  },
};

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/prototype/focus-cards", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  modelIsConfigured: () => true,
}));
vi.mock("@/lib/model-gateway/server", () => ({
  createServerModelGateway: () => {
    state.gatewaysMade += 1;
    // Every method of the spy gateway records its call and fails, so no line is shown.
    return new Proxy(
      {},
      {
        get: (_target, name) => async () => {
          state.gatewayCalls.push(String(name));
          return { ok: false, reason: "spy" };
        },
      },
    );
  },
}));
vi.mock("@/lib/content/repository", () => ({
  getStoryContent: async () => seedContent(),
  // #521: the signed-in actions read the content as the account may play it.
  getStoryContentForViewer: async () => seedContent(),
  readStoryCardsFromSupabase: async () => null,
}));
vi.mock("@/lib/safety/server", () => ({ serverSafetyCheck: () => keywordOnlySafetyCheck }));
vi.mock("@/lib/logging/server-log", () => ({ logEvent: () => {} }));

const { loadAccountReturnLine, loadAccountStepCards } = await import("@/app/focus/actions");
const { loadAccountPauseMessage, loadAccountRestReply } = await import("@/app/rest/actions");
const { finishRunAction } = await import("@/app/end/actions");

const SESSION = "00000000-0000-4000-8000-000000000001";

const actions = {
  "step cards": () =>
    loadAccountStepCards({ sessionId: SESSION, index: 0, planMinutes: [10], earlierCards: [] }),
  "return line": () =>
    loadAccountReturnLine({ storyId: "site-search", trigger: "rest", awayMinutes: 6 }),
  "pause message": () =>
    loadAccountPauseMessage({ storyId: "site-search", pauseNumber: 1, stepTitle: "Draft" }),
  "rest reply": () =>
    loadAccountRestReply({
      storyId: "site-search",
      message: "I am a bit tired today.",
      history: [{ from: "him", text: "The trucks are late again." }],
      replyIndex: 0,
      stepIndex: 0,
      stepCount: 2,
      // #518: the session and the Pause whose round count is kept on the account.
      sessionId: SESSION,
      pauseKey: "00000000-0000-4000-9000-000000000001",
    }),
};

function setFlag(flag: Flag) {
  state.flag = flag;
}

beforeEach(() => {
  state.gatewayCalls = [];
  state.gatewaysMade = 0;
  state.tableReads = [];
});

describe("#114 I2 the server refuses his lines and cards for a flagged account", () => {
  for (const [name, call] of Object.entries(actions)) {
    for (const flag of ["on", "failing"] as const) {
      it(`test_114_i2_${name.replace(" ", "_")}_with_the_flag_${flag}_fails_with_no_model_call`, async () => {
        setFlag(flag);
        await expect(call()).resolves.toEqual({ status: "failed" });
        expect(state.gatewaysMade).toBe(0);
        expect(state.gatewayCalls).toEqual([]);
        // Nothing of the session or the story is read either.
        expect(state.tableReads).toEqual([]);
      });
    }
  }

  it("test_114_i2_with_the_flag_off_the_model_lines_reach_the_gateway", async () => {
    setFlag("off");
    for (const name of ["return line", "pause message", "rest reply"] as const) {
      state.gatewayCalls = [];
      await actions[name]();
      expect(state.gatewayCalls.length, name).toBeGreaterThan(0);
    }
  });

  it("test_114_i2_with_the_flag_off_the_step_cards_read_the_session", async () => {
    setFlag("off");
    await expect(actions["step cards"]()).resolves.toEqual({ status: "failed" });
    // The session is read (it has no row here, so the answer is a failure).
    expect(state.tableReads).toContain("sessions");
    expect(state.gatewayCalls).toEqual([]);
  });
});

describe("#114 I2 /focus does not open when the flag cannot be read", () => {
  it("test_114_i2_load_focus_plan_rejects_when_the_flag_read_fails", async () => {
    const { loadFocusPlan } = await import("@/app/focus/account-progress");
    setFlag("failing");
    await expect(loadFocusPlan(client as never, "user-1", null, true)).rejects.toThrow(
      "The research condition could not be read.",
    );
    setFlag("off");
    // With the flag read, an account with no Goal opens nothing, and nothing throws.
    await expect(loadFocusPlan(client as never, "user-1", null, true)).resolves.toBeNull();
  });

  it("test_114_i2_the_page_shows_a_retry_message_instead_of_the_focus_page", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/focus/page.tsx", "utf8");
    expect(page).toContain('"Could not open this Goal. Try again."');
  });
});

describe("#114 I3 the session store reads and writes story_off_at", () => {
  it("test_114_i3_story_off_at_round_trips_and_is_only_written_when_set", async () => {
    const { createSupabaseProgressStore } = await import("@/lib/progress/supabase-progress");
    const upserts: Record<string, unknown>[][] = [];
    const rows: Record<string, Record<string, unknown>[]> = {
      goals: [],
      steps: [],
      sessions: [
        {
          id: "s1",
          user_id: "user-1",
          goal_id: "g1",
          companion_id: "oppenheimer",
          story_id: "site-search",
          state: "open",
          story_off_at: "2026-11-24T10:00:00.000Z",
        },
      ],
      session_steps: [],
      session_lines: [],
    };
    const fake = {
      from: (table: string) => {
        const chain: Record<string, unknown> = {
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: rows[table] ?? [], error: null }),
          upsert: (values: Record<string, unknown>[]) => {
            if (table === "sessions") upserts.push(values);
            return chain;
          },
        };
        for (const name of ["select", "eq", "in", "insert", "delete"]) chain[name] = () => chain;
        return chain;
      },
    };
    const store = createSupabaseProgressStore(fake as never);
    const progress = await store.read("user-1", "user-1");
    expect(progress.sessions[0].storyOffAt).toBe("2026-11-24T10:00:00.000Z");
    expect(progress.sessions[0].storyId).toBe("site-search");
    await store.write("user-1", progress);
    await store.write("user-1", {
      ...progress,
      sessions: [{ ...progress.sessions[0], storyOffAt: null }],
    });
    expect(upserts[0][0].story_off_at).toBe("2026-11-24T10:00:00.000Z");
    expect("story_off_at" in upserts[1][0]).toBe(false);
  });
});

describe("#114 N2 END refuses a flagged account", () => {
  const input = { sessionId: SESSION };
  for (const flag of ["on", "failing"] as const) {
    it(`test_114_n2_finish_run_with_the_flag_${flag}_fails_with_no_model_call_and_no_read`, async () => {
      setFlag(flag);
      await expect(finishRunAction(input)).resolves.toEqual({ status: "failed" });
      expect(state.gatewayCalls).toEqual([]);
      expect(state.tableReads).toEqual([]);
    });
  }

  it("test_114_n2_finish_run_with_the_flag_off_reads_the_account", async () => {
    setFlag("off");
    await finishRunAction(input);
    expect(state.tableReads).toContain("sessions");
  });
});
