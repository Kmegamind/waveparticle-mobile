import { expect, test } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  FRAME_GATE,
  FRAME_LIVE_PAGES,
  FRAME_PROTOTYPE_PAGES,
  HEIGHT,
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

// #460: the Companions table head (`table head cell`, box height) once failed now and then: while an
// editing test published, Oppenheimer's "Last change" showed that editor's long email and the head
// wrapped at 1024 px. The gate account reads a fixed, seeded publish history (#447). Here another
// account publishes for Oppenheimer the whole time the frame rows are read, and reads its publishes
// back from the shared history; the gate still finds no difference. Run it beside the editing
// tests (story-card-editing, content-field-editing) to see it hold while they publish too.
for (const width of WIDTHS) {
  test(`test_460_the_gate_ignores_publishes_made_while_it_runs_at_${width}_px`, async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000);
    const editorContext = await browser.newContext({ viewport: { width, height: HEIGHT } });
    const editor = await signIn(editorContext, baseUrlOf(page), undefined, {
      contentRole: "admin",
    });
    let versions = 0;
    let seen = 0;
    const publish = async () => {
      versions += 1;
      const answer = await fetch(`${STUB_SUPABASE}/__publish_history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: editor.token,
          append: { kind: "companion_field", item_key: "chr.opp.e2e460", version: versions },
        }),
      });
      expect(answer.ok).toBe(true);
      // Read back as the editor: the row is in the shared history every other account reads (an
      // editing test's reset may remove it again later).
      const shared = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/list_publish_history`, {
        method: "POST",
        headers: { authorization: `Bearer ${editor.token}`, "content-type": "application/json" },
        body: JSON.stringify({ row_limit: 500 }),
      });
      const rows = (await shared.json()) as { acted_by_email: string; version: number }[];
      const email = `${editor.userId}@example.invalid`;
      if (rows.some((row) => row.acted_by_email === email && row.version === versions)) seen += 1;
    };
    await publish();
    let reading = true;
    const publishing = (async () => {
      while (reading) {
        await publish();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();
    let found: string[];
    try {
      found = await compareGate(page, context, FRAME_GATE, width);
    } finally {
      reading = false;
      await publishing;
    }
    expect(versions, "publishes made while the gate read").toBeGreaterThan(2);

    expect(seen, "a publish of this test read back from the shared history").toBeGreaterThan(0);

    const editorPage = await editorContext.newPage();
    await editorPage.goto(`${baseUrlOf(page)}/admin/companions`);
    // For the report: the head height the editor's own Companions page draws (the old failure).
    const head = await editorPage
      .locator(".admin-table th")
      .first()
      .evaluate((cell) => cell.getBoundingClientRect().height);
    test.info().annotations.push({
      type: "editor's Companions table head height",
      description: `${head} px at ${width} px`,
    });
    await editorContext.close();

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
