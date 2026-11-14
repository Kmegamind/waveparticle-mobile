import { describe, expect, it } from "vitest";
import {
  completeStep,
  setStepCards,
  syncSession,
  type FocusSession,
} from "@/lib/prototype/session";
import { focusLabel, focusSecondsOf } from "@/lib/summary/run";

// Issue #258 (SUMMARY-RECORD): the real focus time comes from the clocks on this device (#257,
// decision 0014 keeps the clock on the device).

const plan = {
  goal: { text: "Write", minutes: 30 },
  steps: [
    { title: "Outline", description: "", minutes: 10 },
    { title: "Draft", description: "", minutes: 20 },
  ],
};

function finished(): FocusSession {
  let session = syncSession(null, plan, 1);
  session = setStepCards(session, 0, { opening: "I open the notebook.", story: [] }, 0);
  session = completeStep(session, 700_000);
  session = setStepCards(session, 1, { opening: "I sit down again.", story: [] }, 701_300);
  return completeStep(session, 701_300 + 1_500_000);
}

describe("#258 AC2 focus time", () => {
  it("adds the real time on each Step's clock at Done, overtime included", () => {
    expect(focusSecondsOf(finished())).toBe(2200);
  });

  it("is unknown before the last Done or without this device's session", () => {
    expect(focusSecondsOf(syncSession(null, plan, 1))).toBeNull();
    expect(focusSecondsOf(null)).toBeNull();
  });

  it("is shown in whole minutes, with no verdict", () => {
    expect(focusLabel(10)).toBe("Under 1 min");
    expect(focusLabel(40)).toBe("1 min");
    expect(focusLabel(3600)).toBe("60 min");
  });
});
