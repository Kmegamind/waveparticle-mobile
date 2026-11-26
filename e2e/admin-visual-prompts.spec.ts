import { test } from "@playwright/test";
import { ADMIN_VISUAL_USE, type Gate, STYLE, gateTests } from "./support/admin-visual";

// #446: ADM-08 Prompts. The prompt page against the prototype's Prompts screen; the list against
// the prototype's table components (it has no list screen). Part of the admin visual gate
// (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  characters: { hash: "characters" },
  prompts: { hash: "prompts" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // A detail page: its menu row (Prompts) is marked as current.
  prompt: { path: "/admin/prompts/plan_split" },
  // #446: the prompts list (no prototype screen; drawn with the prototype's table components).
  // Other tests save prompt drafts while the gate runs (rest_reply, stuck_story ...), and a draft
  // changes the list's column widths, so the gate's account reads the seeded prompts only
  // (useSeededPrompts): neither prompt page depends on what other tests write.
  promptList: { path: "/admin/prompts" },
};

const COMPONENTS: Gate["components"] = [
  // #446: ADM-08 Prompts. The prompt page against the prototype's Prompts screen; the list against
  // the prototype's table components (it has no list screen).
  {
    name: "prompt: title chip",
    prototype: { page: "prompts", selector: ".head h1 .key" },
    live: { page: "prompt", selector: ".admin-head h1 .admin-chip" },
    box: ["height"],
  },
  {
    name: "prompt: header action row",
    prototype: { page: "prompts", selector: ".head .btns" },
    live: { page: "prompt", selector: ".admin-head .admin-actions" },
  },
  {
    name: "prompt: header secondary button (Save draft)",
    prototype: { page: "prompts", selector: ".head .btns button:not(.primary)" },
    live: { page: "prompt", selector: ".admin-actions .button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "prompt: two columns",
    prototype: { page: "prompts", selector: ".grid2" },
    live: { page: "prompt", selector: ".admin-prompt-grid" },
    box: ["x", "width"],
  },
  {
    name: "prompt: left panel",
    prototype: { page: "prompts", selector: ".grid2 > .panel:first-child" },
    live: { page: "prompt", selector: ".admin-prompt-grid > .admin-panel:first-child" },
    box: ["x", "width"],
  },
  {
    name: "prompt: right panel",
    prototype: { page: "prompts", selector: ".grid2 > .panel:last-child" },
    live: { page: "prompt", selector: ".admin-prompt-grid > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "prompt: panel heading",
    prototype: { page: "prompts", selector: ".grid2 > .panel:last-child h2" },
    live: { page: "prompt", selector: ".admin-prompt-grid .admin-prompt-heading" },
  },
  {
    name: "prompt: heading chip",
    prototype: { page: "prompts", selector: ".grid2 > .panel:last-child h2 .key" },
    live: { page: "prompt", selector: ".admin-prompt-heading .admin-chip" },
    box: ["height"],
  },
  {
    name: "prompt: prompt text",
    prototype: { page: "prompts", selector: "pre.code" },
    live: { page: "prompt", selector: "pre.admin-prompt-code" },
  },
  {
    name: "prompt: prompt text field",
    prototype: { page: "prompts", selector: "pre.code" },
    live: { page: "prompt", selector: "textarea.admin-prompt-code" },
  },
  {
    name: "prompt: note line",
    prototype: { page: "prompts", selector: ".grid2 p.note" },
    live: { page: "prompt", selector: ".admin-prompt-note" },
  },
  {
    name: "prompt: Versions heading",
    prototype: { page: "prompts", selector: ".grid2 > .panel:last-child h2:nth-of-type(2)" },
    live: { page: "prompt", selector: ".admin-prompt-versions .admin-prompt-heading" },
  },
  {
    name: "prompt: Versions table",
    prototype: { page: "prompts", selector: ".grid2 table" },
    live: { page: "prompt", selector: ".admin-prompt-versions .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "prompt: Versions cell",
    prototype: { page: "prompts", selector: ".grid2 td" },
    live: { page: "prompt", selector: ".admin-prompt-versions td" },
  },
  {
    name: "prompt: Versions chip",
    prototype: { page: "prompts", selector: ".grid2 td .key" },
    live: { page: "prompt", selector: ".admin-prompt-versions td .admin-chip" },
    box: ["height"],
  },
  {
    name: "prompt: Versions pill (Active)",
    prototype: { page: "prompts", selector: ".grid2 .pill.s-pub" },
    live: { page: "prompt", selector: ".admin-prompt-versions .admin-pill-published" },
    box: ["height"],
  },
  {
    name: "prompts list: panel",
    prototype: { page: "characters", selector: ".panel" },
    live: { page: "promptList", selector: ".admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "prompts list: table",
    prototype: { page: "characters", selector: "table" },
    live: { page: "promptList", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "prompts list: head cell",
    prototype: { page: "characters", selector: "th" },
    live: { page: "promptList", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "prompts list: cell",
    prototype: { page: "characters", selector: "td" },
    live: { page: "promptList", selector: ".admin-table td" },
  },
  {
    name: "prompts list: id chip",
    prototype: { page: "characters", selector: "td .key" },
    live: { page: "promptList", selector: ".admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "prompts list: pill (Active)",
    prototype: { page: "characters", selector: ".pill.s-pub" },
    live: { page: "promptList", selector: ".admin-table .admin-pill-published" },
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  // #446: ADM-08 Prompts.
  {
    component: "prompt: header secondary button (Save draft)",
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the prototype has none (auto). Neither draws a minimum.",
  },
  {
    component: "prompt: header secondary button (Save draft)",
    properties: ["box height"],
    reason:
      "The prototype's action row also holds the model list (a select, 36 px tall), and the row " +
      "stretches its buttons to it, so Test draft is 36 px. Live has no model list (an owner " +
      "decision: no per-prompt model in the data), so Save draft keeps its own 33.5 px, the " +
      "height of the prototype's own secondary button (compared in `secondary button`).",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_446_prompts_match_the_prototype_at_${width}_px`);
