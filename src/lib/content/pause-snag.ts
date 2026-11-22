import type { SceneTable } from "./scene";

/**
 * The snag categories of a Pause (docs/ai/AI_03 section A1, PAUSE-TWO-CALLS). There is no weather
 * category (SCENE-PER-STORY). The code picks the category and the prop; the model only writes the
 * stuck story around them (#56 AC2).
 */
export const PAUSE_CATEGORIES = ["body", "gear", "ground", "paper", "sound"] as const;

export type PauseCategory = (typeof PAUSE_CATEGORIES)[number];

export function isPauseCategory(value: unknown): value is PauseCategory {
  return typeof value === "string" && (PAUSE_CATEGORIES as readonly string[]).includes(value);
}

/** The categories of the two Pauses before this one are not used again. */
const CATEGORY_GAP = 2;

/**
 * The category and the prop of this Pause.
 *
 * - Category: one not used in the last two Pauses of the run (`recentCategories`, oldest first),
 *   taken in a fixed round after the most recent one, so every category comes up in turn.
 * - Prop: from the Story's scene table, the pause prop first, then the other props in table
 *   order, skipping every prop already used in this Step (`usedProps`). When every prop was used,
 *   the round starts again, skipping the prop of the Pause just before.
 *
 * Values from the browser that are not a category or a prop of this scene are ignored.
 */
export function pickPauseSnag(input: {
  scene: SceneTable;
  recentCategories: string[];
  usedProps: string[];
}): { category: PauseCategory; prop: string } {
  const recent = input.recentCategories.filter(isPauseCategory).slice(-CATEGORY_GAP);
  const last = recent.at(-1);
  const start = last ? PAUSE_CATEGORIES.indexOf(last) + 1 : 0;
  const order = PAUSE_CATEGORIES.map(
    (_, offset) => PAUSE_CATEGORIES[(start + offset) % PAUSE_CATEGORIES.length],
  );
  const category = order.find((item) => !recent.includes(item)) ?? order[0];

  const { pauseProp, props } = input.scene;
  const candidates = [
    ...(pauseProp.trim() ? [pauseProp] : []),
    ...props.filter((prop) => prop !== pauseProp),
  ];
  const used = input.usedProps.filter((prop) => candidates.includes(prop));
  const fresh = candidates.find((prop) => !used.includes(prop));
  const prop =
    fresh ?? candidates.find((prop) => prop !== used.at(-1)) ?? candidates[0] ?? pauseProp;
  return { category, prop };
}
