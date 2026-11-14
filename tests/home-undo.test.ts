import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/home-actions", () => ({ setGoalStatusAction: async () => ({ status: "failed" }) }));

const { afterUndo, undoRequest } = await import("@/app/home-goal-options");

// #268 final review: Undo reopens the session it parked, and a failed Undo is said, not dropped.

const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const toast = {
  goalId: GOAL,
  previous: "in_progress" as const,
  parkedSessionId: "s1",
  text: "Goal put on hold",
};

describe("#268 AC4 Undo", () => {
  it("Undo asks for the previous status and the session it parked", () => {
    expect(undoRequest(toast)).toEqual({ goalId: GOAL, status: "in_progress", sessionId: "s1" });
  });

  it("a failed Undo keeps a toast that says so and can be tried again", () => {
    expect(afterUndo(toast, { status: "ok", previous: "on_hold" })).toBeNull();
    expect(afterUndo(toast, { status: "failed" })).toEqual({
      ...toast,
      text: "Could not undo. Please try again.",
    });
  });
});
