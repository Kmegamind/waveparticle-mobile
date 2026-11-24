import { beforeEach, describe, expect, it, vi } from "vitest";

// #256: the real server actions hand process.env to splitGoal, which reads the switch from it.

const seen: { env?: unknown }[] = [];

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("@/lib/goal-dialogue/server", () => ({ serverTurnDeps: (split: unknown) => ({ split }) }));
vi.mock("@/lib/goal-dialogue/turns", () => ({
  takeTurn: async (_request: unknown, deps: { split: (input: unknown) => Promise<unknown> }) =>
    deps.split({ goal: "x", totalMinutes: 30, splitFiner: false }),
}));
vi.mock("@/lib/prototype/split-goal", () => ({
  splitGoal: async (_input: unknown, deps: { env: unknown }) => void seen.push({ env: deps.env }),
}));
vi.mock("@/lib/safety/server", () => ({ serverSafetyCheck: () => undefined }));
vi.mock("@/lib/model-gateway/server", () => ({ createServerModelGateway: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: async () => ({ id: "u" }) }));

describe("the limit switch reaches the model-call path", () => {
  beforeEach(() => {
    seen.length = 0;
    vi.stubEnv("PROTOTYPE_ENABLED", "1");
  });

  it("/try passes process.env to splitGoal", async () => {
    const { goalTurnAction } = await import("@/app/try/goal/actions");
    await goalTurnAction({ kind: "goal" } as never);
    expect(seen).toHaveLength(1);
    expect(seen[0].env).toBe(process.env);
  });

  it("/goal passes process.env to splitGoal", async () => {
    const { goalTurnForAccountAction } = await import("@/app/goal/actions");
    await goalTurnForAccountAction({ kind: "goal" } as never);
    expect(seen).toHaveLength(1);
    expect(seen[0].env).toBe(process.env);
  });
});
