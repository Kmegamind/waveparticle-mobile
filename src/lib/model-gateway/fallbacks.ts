import type { LineResult, PlanSplitResult } from "./types";

const FALLBACK_CARD = "I keep at the work in front of me. My papers are still on the table.";
const FALLBACK_STUCK = "I am held on a small snag in my work.";
const FALLBACK_REPLY = "I stay with my own work.";
const FALLBACK_RETURN =
  "I kept my eyes on the papers in front of me. The room stayed as I had left it a moment before. My hands returned to the work on the table.";

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export function fallbackPlan(goal: string, totalMinutes: number): PlanSplitResult {
  const minutes = Number.isInteger(totalMinutes) && totalMinutes > 0 ? totalMinutes : 1;
  const title = clip(goal, 40) || "One step";
  return {
    source: "authored",
    title,
    steps: [
      {
        title: clip(goal, 80) || "One step",
        description: "Do this for the time you set.",
        minutes,
      },
    ],
  };
}

export function fallbackStepCards(): { source: "authored"; cards: string[] } {
  return { source: "authored", cards: [FALLBACK_CARD] };
}

export function fallbackStuck(): LineResult {
  return { source: "authored", text: FALLBACK_STUCK };
}

export function fallbackReply(): LineResult {
  return { source: "authored", text: FALLBACK_REPLY };
}

export function fallbackReturn(): LineResult {
  return { source: "authored", text: FALLBACK_RETURN };
}
