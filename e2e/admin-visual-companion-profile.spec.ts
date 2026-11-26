import { test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  type Gate,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #442: Companion profile (ADM-04) against the prototype's `character` screen. Part of the admin
// visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  character: { hash: "character" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #442: Companion profile (ADM-04), the prototype's `character` screen.
  companion: { path: "/admin/companions/oppenheimer" },
};

const COMPONENTS: Gate["components"] = [
  // #442: Companion profile (ADM-04): the real header actions, the tabs and the dl.fields rows.
  // Read on Oppenheimer's Profile tab, whose fields no other test writes.
  {
    name: "header row (Companion profile)",
    prototype: { page: "character", selector: ".head" },
    live: { page: "companion", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "header action row (Companion profile)",
    prototype: { page: "character", selector: ".head .btns" },
    live: { page: "companion", selector: ".admin-head .admin-actions" },
  },
  {
    name: "main button (Companion profile)",
    prototype: { page: "character", selector: ".head button.primary" },
    live: { page: "companion", selector: ".admin-head .admin-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "secondary button (Companion profile)",
    prototype: { page: "character", selector: ".head .btns button:not(.primary)" },
    live: { page: "companion", selector: ".admin-head .admin-actions .button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "tab bar",
    prototype: { page: "character", selector: ".tabs" },
    live: { page: "companion", selector: ".admin-tabs" },
    box: ["x", "width", "height"],
  },
  {
    name: "tab",
    prototype: { page: "character", selector: ".tabs button:not(.on)" },
    live: { page: "companion", selector: '.admin-tab[aria-selected="false"]' },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "tab, current",
    prototype: { page: "character", selector: ".tabs button.on" },
    live: { page: "companion", selector: '.admin-tab[aria-selected="true"]' },
    properties: [...STYLE, "cursor"],
    box: ["x", "height"],
  },
  {
    name: "fields panel",
    prototype: { page: "character", selector: ".tabs + .panel" },
    live: { page: "companion", selector: ".admin-tabs + .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "field list (dl.fields)",
    prototype: { page: "character", selector: "dl.fields" },
    live: { page: "companion", selector: "dl.admin-fields" },
    box: ["x", "width"],
  },
  {
    name: "field label (dt)",
    prototype: { page: "character", selector: "dl.fields dt" },
    live: { page: "companion", selector: "dl.admin-fields dt" },
    box: ["x", "width"],
  },
  {
    name: "field value (dd)",
    prototype: { page: "character", selector: "dl.fields dd" },
    live: { page: "companion", selector: "dl.admin-fields dd" },
    box: ["x", "width"],
  },
  {
    name: "field id chip",
    prototype: { page: "character", selector: "dl.fields dt .key" },
    live: { page: "companion", selector: "dl.admin-fields dt .admin-chip" },
    box: ["height"],
  },
  {
    name: "field text, edited in place",
    prototype: { page: "character", selector: "dl.fields dd [contenteditable]" },
    live: { page: "companion", selector: "dl.admin-fields dd [contenteditable]" },
  },
  {
    name: "field pill (Published)",
    prototype: { page: "character", selector: "dl.fields dd .pill.s-pub" },
    live: { page: "companion", selector: "dl.admin-fields dd .admin-pill-published" },
    box: ["height"],
  },
  {
    // The prototype's Draft pill; live draws Draft, Not written and Read only in the same grey.
    name: "field pill (grey)",
    prototype: { page: "character", selector: "dl.fields dd .pill.s-draft" },
    live: { page: "companion", selector: "dl.admin-fields dd .admin-pill-earlier" },
    box: ["height"],
  },
  {
    name: "panel note",
    prototype: { page: "character", selector: ".panel > .note" },
    live: { page: "companion", selector: ".admin-panel > .admin-fields-note" },
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  // #442: Companion profile.
  ...["main button (Companion profile)", "secondary button (Companion profile)"].map(
    (component) => ({
      component,
      properties: ["min-width", "min-height"],
      reason:
        "As `main button` and `secondary button`: live sets 0 to switch off the phone app's 44 px " +
        "tap minimum (ADMIN-DESKTOP); the prototype has none (auto). The height is compared.",
    }),
  ),
  {
    component: "field text, edited in place",
    properties: ["white-space"],
    reason:
      "Live is pre-wrap, the prototype normal: stored production text may contain line breaks " +
      "(the earlier editor was a textarea that allowed them), and they must stay visible and be " +
      "saved back unchanged.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_442_companion_profile_matches_the_prototype_at_${width}_px`);

// #442: the Companion profile pictures for its pull request (prototype `character` vs live
// Oppenheimer, Profile tab) at each width. Written only on request.
test("test_442_companion_profile_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, [
    {
      name: "companion-profile",
      prototype: PROTOTYPE_PAGES.character,
      live: LIVE_PAGES.companion,
      fullPage: false,
    },
  ]);
});
