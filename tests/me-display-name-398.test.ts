import { describe, expect, it, vi } from "vitest";
import type { SafetyCheck, SafetyGate } from "@/lib/safety/check";
import {
  displayNameReducer,
  FAILED_ERROR,
  initialDisplayName,
  INVALID_ERROR,
  SAVED_ANNOUNCEMENT,
  type DisplayNameEvent,
  type DisplayNameState,
} from "@/lib/me/display-name-edit";

// #398 (follow-up to #392): the Me wiring is tested by what it does, not by its source text.

const USER = "11111111-1111-4111-8111-111111111111";

// The action's own dependencies are replaced, so the real server check, Supabase and the model
// are never reached. `serverSafetyCheck()` hands out the fake check below.
const check = vi.fn<SafetyCheck>();
const upsert = vi.fn(async () => {});
vi.mock("@/lib/safety/server", () => ({ serverSafetyCheck: () => check }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/session", () => ({ getCurrentUser: async () => ({ id: USER }) }));
vi.mock("@/lib/me/supabase-profile", () => ({
  createSupabaseProfileWriter: () => ({ upsert }),
}));

const { saveDisplayNameAction } = await import("@/app/me/actions");

const gate = (crisis: boolean): SafetyGate => ({
  action: crisis ? "crisis-page" : "continue",
  tier: crisis ? "crisis" : "none",
  layer: "classifier",
});

describe("#398 AC5 the action runs the server's check before the save", () => {
  it("test_398_ac5_a_crisis_from_the_server_check_saves_nothing", async () => {
    check.mockReset().mockResolvedValue(gate(true));
    upsert.mockClear();
    expect(await saveDisplayNameAction({ name: " Ada " })).toEqual({ status: "crisis" });
    expect(check).toHaveBeenCalledWith("Ada", { position: "display_name" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("test_398_ac5_an_ordinary_name_is_checked_then_saved", async () => {
    check.mockReset().mockResolvedValue(gate(false));
    upsert.mockClear();
    expect(await saveDisplayNameAction({ name: "Ada" })).toEqual({ status: "ok", name: "Ada" });
    expect(check).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(USER, { nickname: "Ada" });
  });
});

const run = (events: DisplayNameEvent[], start = initialDisplayName("Ada")) =>
  events.reduce<DisplayNameState>(displayNameReducer, start);

const editing = run([{ type: "edit" }, { type: "type", text: "Grace" }]);

describe("#398 AC3 Save shows a pending state and cannot be pressed twice", () => {
  it("test_398_ac3_a_second_save_while_pending_changes_nothing", () => {
    const once = displayNameReducer(editing, { type: "save" });
    expect(once.pending).toBe(1);
    expect(displayNameReducer(once, { type: "save" })).toBe(once);
  });

  it("test_398_ac3_the_field_cannot_change_while_pending", () => {
    const pending = displayNameReducer(editing, { type: "save" });
    expect(displayNameReducer(pending, { type: "type", text: "other" }).draft).toBe("Grace");
  });

  it("test_398_ac3_a_crisis_after_cancel_does_not_open_s1", () => {
    const after = run(
      [
        { type: "save" },
        { type: "cancel" },
        { type: "answer", request: 1, outcome: { status: "crisis" } },
      ],
      editing,
    );
    expect(after.crisisShown).toBe(0);
    expect(after.editing).toBe(false);
    expect(after.name).toBe("Ada");
    expect(after.draft).toBe("Ada");
  });

  it("test_398_ac3_an_old_answer_does_not_touch_a_newer_save", () => {
    const after = run(
      [
        { type: "save" },
        { type: "cancel" },
        { type: "edit" },
        { type: "type", text: "Lise" },
        { type: "save" },
        { type: "answer", request: 1, outcome: { status: "ok", name: "Grace" } },
      ],
      editing,
    );
    expect(after.pending).toBe(2);
    expect(after.name).toBe("Ada");
    expect(after.draft).toBe("Lise");
  });

  it("test_398_ac3_a_crisis_answer_empties_the_field_keeps_edit_mode_and_opens_s1_once", () => {
    const after = run(
      [{ type: "save" }, { type: "answer", request: 1, outcome: { status: "crisis" } }],
      editing,
    );
    expect(after).toMatchObject({
      editing: true,
      draft: "",
      name: "Ada",
      pending: null,
      error: "",
      crisisShown: 1,
    });
  });
});

describe("#398 AC4 no stale announcement", () => {
  const saved = run(
    [{ type: "save" }, { type: "answer", request: 1, outcome: { status: "ok", name: "Grace" } }],
    editing,
  );

  it("test_398_ac4_a_save_announces_and_leaves_edit_mode", () => {
    expect(saved).toMatchObject({ name: "Grace", editing: false, announce: SAVED_ANNOUNCEMENT });
  });

  it("test_398_ac4_a_crisis_after_a_save_leaves_no_saved_announcement", () => {
    const after = run(
      [
        { type: "edit" },
        { type: "type", text: "flagged" },
        { type: "save" },
        { type: "answer", request: 2, outcome: { status: "crisis" } },
      ],
      saved,
    );
    expect(after.announce).toBe("");
    expect(after.crisisShown).toBe(1);
  });

  it("test_398_ac4_a_failed_save_clears_the_announcement_and_keeps_the_text", () => {
    for (const [status, message] of [
      ["invalid", INVALID_ERROR],
      ["failed", FAILED_ERROR],
    ] as const) {
      const after = run(
        [
          { type: "edit" },
          { type: "type", text: "Lise" },
          { type: "save" },
          { type: "answer", request: 2, outcome: { status } },
        ],
        saved,
      );
      expect(after).toMatchObject({ announce: "", error: message, draft: "Lise", editing: true });
    }
  });

  it("test_398_ac4_a_second_successful_save_announces_again", () => {
    const pending = run([{ type: "edit" }, { type: "save" }], saved);
    expect(pending.announce).toBe("");
    const again = displayNameReducer(pending, {
      type: "answer",
      request: 2,
      outcome: { status: "ok", name: "Grace" },
    });
    expect(again.announce).toBe(SAVED_ANNOUNCEMENT);
  });
});
