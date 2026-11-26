import { test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  type Gate,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #443 Stories: the Life path table's fixed components against the prototype's Life path screen.
// Part of the admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  // #443 Stories: the prototype's Life path screen.
  lifepath: { hash: "lifepath" },
  characters: { hash: "characters" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #443: the Stories page (the Life path table).
  stories: { path: "/admin/stories" },
};

const COMPONENTS: Gate["components"] = [
  {
    name: "Life path panel (scrolls sideways)",
    prototype: { page: "lifepath", selector: ".panel.scroll" },
    live: { page: "stories", selector: ".admin-panel.admin-scroll" },
    properties: [...STYLE, "overflow-x"],
    box: ["x", "width"],
  },
  {
    name: "Life path table",
    prototype: { page: "lifepath", selector: "table" },
    live: { page: "stories", selector: ".admin-life-path" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "Life path head cell (#)",
    prototype: { page: "lifepath", selector: "th.num" },
    live: { page: "stories", selector: ".admin-life-path th.admin-num" },
    properties: [...STYLE, "font-variant-numeric"],
    box: ["height"],
  },
  {
    name: "Life path period row",
    prototype: { page: "lifepath", selector: 'td[colspan="4"]' },
    live: { page: "stories", selector: ".admin-period-row td" },
  },
  {
    name: "Life path period key chip",
    prototype: { page: "lifepath", selector: 'td[colspan="4"] .key' },
    live: { page: "stories", selector: ".admin-period-row .admin-chip" },
    box: ["height"],
  },
  {
    name: "Life path story number cell",
    prototype: { page: "lifepath", selector: "td.num" },
    live: { page: "stories", selector: ".admin-life-path td.admin-num" },
    properties: [...STYLE, "font-variant-numeric"],
  },
  {
    name: "Life path story title",
    prototype: { page: "lifepath", selector: "td b" },
    live: { page: "stories", selector: ".admin-life-path .admin-cell-name" },
  },
  {
    name: "Life path story key chip",
    prototype: { page: "lifepath", selector: "tr.click td .key" },
    live: { page: "stories", selector: ".admin-life-path tr[aria-label] .admin-chip" },
    box: ["height"],
  },
  {
    name: "Life path description note",
    prototype: { page: "lifepath", selector: "td .note" },
    live: { page: "stories", selector: ".admin-life-path .admin-path-note" },
  },
  {
    name: "pill (Draft, grey)",
    prototype: { page: "characters", selector: ".pill.s-draft" },
    live: { page: "stories", selector: ".admin-life-path .admin-pill-draft" },
    box: ["height"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  {
    component: "Life path story title",
    properties: ["text-decoration-line", "align-items"],
    reason:
      "Live shows each story title as an underlined link (.admin-cell-name), reachable by keyboard; " +
      "the prototype shows bold text (<b>, no underline) in a clickable row, which a keyboard " +
      "cannot reach. align-items comes from the phone app's global link rule (center); it has no " +
      "effect on an inline element, and display is compared (inline on both sides). Every other " +
      "style of the title is compared.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_443_stories_match_the_prototype_at_${width}_px`);

// #443: the Stories pictures for its pull request: the prototype's Life path screen vs the live
// Stories page at each width, the top of the page, prototype on the left. Written only on request.
test("test_443_stories_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page, "/admin/stories");
  await writePictures(page, origin, [
    {
      name: "stories",
      prototype: PROTOTYPE_PAGES.lifepath,
      live: LIVE_PAGES.stories,
      fullPage: false,
      prototypeCaption: "Prototype Life path (standards mode)",
      liveCaption: "Live Stories",
    },
  ]);
});
