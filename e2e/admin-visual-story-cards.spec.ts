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

// #444 Story cards (ADM-06): the prototype's cards editor and phone preview, against
// /admin/stories/site-search. Part of the admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  cards: { hash: "cards" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #444: one story's cards. No test writes "site-search", so the gate reads the seed as loaded.
  storyCards: { path: "/admin/stories/site-search" },
};

const COMPONENTS: Gate["components"] = [
  {
    name: "story cards: editor (cards beside the preview)",
    prototype: { page: "cards", selector: ".editor" },
    live: { page: "storyCards", selector: ".admin-cards-editor" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "story cards: part panel",
    prototype: { page: "cards", selector: ".part" },
    live: { page: "storyCards", selector: ".admin-cards-part" },
    box: ["x", "width"],
  },
  {
    name: "story cards: part header",
    prototype: { page: "cards", selector: ".part > header" },
    live: { page: "storyCards", selector: ".admin-cards-part > header" },
    box: ["width"],
  },
  {
    name: "story cards: part title",
    prototype: { page: "cards", selector: ".part > header b" },
    live: { page: "storyCards", selector: ".admin-cards-part > header h2" },
  },
  {
    name: "story cards: part key chip",
    prototype: { page: "cards", selector: ".part > header .key" },
    live: { page: "storyCards", selector: ".admin-cards-part > header .admin-chip" },
    box: ["height"],
  },
  {
    name: "story cards: card row",
    prototype: { page: "cards", selector: ".cardrow" },
    live: { page: "storyCards", selector: ".admin-cards-row" },
    box: ["x", "width"],
  },
  {
    name: "story cards: kind column",
    prototype: { page: "cards", selector: ".cardrow .kind" },
    live: { page: "storyCards", selector: ".admin-cards-kind" },
    box: ["width"],
  },
  {
    name: "story cards: kind key chip",
    prototype: { page: "cards", selector: ".cardrow .kind .key" },
    live: { page: "storyCards", selector: ".admin-cards-kind .admin-chip" },
    box: ["height"],
  },
  {
    name: "story cards: card text",
    prototype: { page: "cards", selector: ".cardrow .txt" },
    live: { page: "storyCards", selector: ".admin-cards-body" },
  },
  {
    name: "story cards: card meta",
    prototype: { page: "cards", selector: ".cardrow .meta" },
    live: { page: "storyCards", selector: ".admin-cards-meta" },
  },
  {
    name: "story cards: meta note",
    prototype: { page: "cards", selector: ".cardrow .meta .note" },
    live: { page: "storyCards", selector: ".admin-cards-meta .admin-cards-note" },
  },
  {
    name: "story cards: meta button row",
    prototype: { page: "cards", selector: ".cardrow .meta .btns" },
    live: { page: "storyCards", selector: ".admin-cards-meta .admin-cards-buttons" },
  },
  {
    name: "story cards: small button",
    prototype: { page: "cards", selector: ".cardrow .meta button.small" },
    live: { page: "storyCards", selector: ".admin-cards-meta .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "story cards: phone",
    prototype: { page: "cards", selector: ".phone" },
    live: { page: "storyCards", selector: ".admin-phone" },
    properties: [...STYLE, "position", "top"],
    box: ["width"],
  },
  {
    name: "story cards: phone top line",
    prototype: { page: "cards", selector: ".phone .ph-top" },
    live: { page: "storyCards", selector: ".admin-phone-top" },
    properties: [...STYLE, "opacity"],
  },
  {
    name: "story cards: note under the phone",
    prototype: { page: "cards", selector: "aside > p.note" },
    live: { page: "storyCards", selector: ".admin-phone-note" },
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  {
    component: "story cards: small button",
    properties: ["min-width", "min-height"],
    reason:
      "As the other buttons: live sets 0 to switch off the phone app's 44 px tap minimum inside " +
      "the admin (ADMIN-DESKTOP); the prototype has none (auto). The height is compared.",
  },
  {
    component: "story cards: note under the phone",
    properties: ["margin-bottom"],
    reason:
      "The prototype's note keeps the browser's default paragraph margin (1em) under it; it is " +
      "the last thing in the column and draws nothing. Its top margin (8 px) is compared.",
  },
  {
    component: "story cards: phone contents (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "Inside the phone the prototype draws a sample of the focus page in its own look (My goal, " +
      "a .slip, Your step, the clock). Live shows the app's own story card (the focus page's " +
      "slip, StoryCardSlip), as phones draw it (#444 brief); the Goal, Step and clock are a " +
      "user's data the admin does not have. The phone frame and its top line are compared.",
  },
  {
    component: "story cards: failed check line (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype's .fails line (11.5 px, bad colour) has its live twin in .admin-cards-fails " +
      "with the same tokens, but no card of the seed story the gate reads fails a check, and the " +
      "gate never writes rows. e2e/admin-story-cards.spec.ts checks the problems list on a card.",
  },
  {
    component: "story cards: state pills (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype's card states (Generated, Checks passed, Read by a person) have no data " +
      "live (owner decisions in #444); live shows Published or Draft and Check failed, the same " +
      "pill compared as `pill (Published)` and `pill dot`.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_444_story_cards_match_the_prototype_at_${width}_px`);

// #444: the Story cards pictures for the pull request (prototype's Story cards vs
// /admin/stories/site-search), 1400 px tall so the first parts and the phone are in view.
test("test_444_story_cards_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, [
    {
      name: "story-cards",
      prototype: PROTOTYPE_PAGES.cards,
      live: LIVE_PAGES.storyCards,
      fullPage: false,
      height: 1400,
    },
  ]);
});
