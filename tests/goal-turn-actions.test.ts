import { beforeEach, describe, expect, it, vi } from "vitest";

// The guards in front of the goal dialogue's turn actions (#347, from #31).
const state = vi.hoisted(() => ({ prototype: true, user: null as { id: string } | null }));
const cookies = vi.hoisted(() => vi.fn(async () => ({ get: () => undefined, set: () => {} })));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/prototype/config", () => ({ isPrototypeEnabled: () => state.prototype }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/goals/supabase-goal-writer", () => ({ createSupabaseGoalWriter: () => ({}) }));
vi.mock("@/lib/model-gateway/server", () => ({
  createServerModelGateway: () => ({}),
  MODEL_GATEWAY_ENV_NAMES: ["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"],
}));

const { goalTurnAction } = await import("@/app/try/goal/actions");
const { goalTurnForAccountAction } = await import("@/app/goal/actions");

const goalTurn = { kind: "goal", goal: "Write the report" } as const;

beforeEach(() => {
  state.prototype = true;
  state.user = null;
  cookies.mockClear();
});

describe("#347 the /try turn action", () => {
  it("refuses every turn when the test path is off, before any split", async () => {
    state.prototype = false;
    expect(await goalTurnAction(goalTurn)).toEqual({ status: "refused" });
    expect(cookies).not.toHaveBeenCalled();
  });

  it("takes the turn when the test path is on", async () => {
    expect(await goalTurnAction(goalTurn)).toMatchObject({ status: "turn" });
  });
});

describe("#347 the /goal turn action", () => {
  it("refuses every turn for a signed-out visitor, before any split", async () => {
    expect(await goalTurnForAccountAction(goalTurn)).toEqual({ status: "refused" });
    expect(cookies).not.toHaveBeenCalled();
  });

  it("does not depend on the test-path switch", async () => {
    state.prototype = false;
    state.user = { id: "user-1" };
    expect(await goalTurnForAccountAction(goalTurn)).toMatchObject({ status: "turn" });
  });
});
