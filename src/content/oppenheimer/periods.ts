/**
 * The named periods of Oppenheimer's Life Path (PERIODS, 2026-11-12): no dates or ages are shown.
 * The names and the grouping are the drafts of prototype v4; they are not approved yet
 * (docs/DECISIONS.md, open item PERIOD-NAMES).
 */
export const PERIOD_STATUS = "draft, not approved (PERIOD-NAMES)";

export const PERIOD_DRAFTS: { name: string; storyIds: string[] }[] = [
  { name: "His youth", storyIds: ["bohr-difficulties"] },
  {
    name: "The Berkeley years",
    storyIds: [
      "tolman-lecture",
      "truchas-morning",
      "midnight-pamphlet",
      "marry-a-friend",
      "union-meeting",
    ],
  },
  {
    name: "The Manhattan Project years",
    storyIds: [
      "groves-berkeley",
      "site-search",
      "kitchen-martinis",
      "pash-interview",
      "gadget-meeting",
      "interim-committee",
      "trinity",
      "panel-final-report",
      "farewell-ceremony",
      "oval-office",
      "eagle-hill-garden",
      "shelter-island",
    ],
  },
  { name: "After the war", storyIds: ["huac-closed-session", "letter-to-uncle-jim"] },
  {
    name: "The hearings",
    storyIds: [
      "face-to-face-with-crouch",
      "griggs-in-princeton",
      "strauss-ultimatum",
      "cross-examination",
      "dreadful-weapon",
    ],
  },
  { name: "His later years", storyIds: ["fermi-award"] },
];
