import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  FRAME_GATE,
  FRAME_LIVE_PAGES,
  FRAME_PROTOTYPE_PAGES,
  WIDTHS,
  compareGate,
  openLive,
  picturesOnRequest,
  registerGate,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #435: the admin visual gate, frame and shared components: the page, the rail and its menu rows,
// the page header, panels, tables, pills, chips, buttons and text fields, compared on Companions
// (and a few stand-ins) with the prototype at 1024 and 1280 px. The rows, the readers and the
// exceptions are in e2e/support/admin-visual.ts.
//
// #483: each admin page compares its own components in its own file, e2e/admin-visual-<page>
// .spec.ts (overview, companions, companion-profile, stories, story-cards, app-text, prompts,
// publish-history, hotlines, ai-features, ai-registry). The `desktop` Playwright project runs
// them all; a pull request that changes /admin passes every one of them.

test.use(ADMIN_VISUAL_USE);

registerGate(FRAME_GATE);

for (const width of WIDTHS) {
  test(`test_435_ac5_fixed_components_match_the_prototype_at_${width}_px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const found = await compareGate(page, context, FRAME_GATE, width);

    // AC1 "renders them": the live admin has drawn its three fonts at the weights it uses.
    await openLive(page, FRAME_LIVE_PAGES.companions);
    // fonts.load() answers the faces that serve a font; none means the browser falls back.
    const missing = await page.evaluate(async () => {
      const wanted = [
        '500 19px "Fraunces"',
        '600 26px "Fraunces"',
        '400 14px "IBM Plex Sans"',
        '500 11px "IBM Plex Sans"',
        '600 14px "IBM Plex Sans"',
        '400 10.5px "IBM Plex Mono"',
        '500 12px "IBM Plex Mono"',
      ];
      const loaded = await Promise.all(wanted.map((font) => document.fonts.load(font, "Aa")));
      return wanted.filter(
        (_font, index) =>
          loaded[index].length === 0 || loaded[index].some((face) => face.status !== "loaded"),
      );
    });
    expect(missing, "admin fonts that did not load").toEqual([]);

    expect(found, `differences from the prototype at ${width} px`).toEqual([]);
  });
}

// The pictures for the pull request: the frame (Companions vs the prototype's Characters) at each
// width, prototype on the left, live on the right. Written only on request.
test("test_435_frame_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, [
    {
      name: "frame",
      prototype: FRAME_PROTOTYPE_PAGES.characters,
      live: FRAME_LIVE_PAGES.companions,
      fullPage: false,
      alignTop: true,
    },
  ]);
});
