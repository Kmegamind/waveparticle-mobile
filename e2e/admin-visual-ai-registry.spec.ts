import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  FRAME_COMPONENTS,
  FRAME_GATE,
  FRAME_PROTOTYPE_PAGES,
  HEIGHT,
  REFERENCE_DIR,
  WIDTHS,
  differences,
  openPrototype,
  picturesOnRequest,
  read,
  registerGate,
  startPrototypeServing,
  type Gate,
  type PageSetup,
  type Reading,
} from "./support/admin-visual";
import { writeFileSync } from "node:fs";
import path from "node:path";

// #467: the AI feature registry screens of the drawing (docs/design/prototype/admin-ai-features
// .html). No live page draws them yet, so they are compared with the prototype's own frame. Part
// of the admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

/**
 * #467: the AI feature registry screens of admin-ai-features.html (registry, feature detail, run
 * panel, comparison lab, runs, samples), each in every state, at hash `reg-<screen>/<state>`. No
 * live page draws them yet, so no live row compares them; test_467 reads each one's frame.
 */
const REGISTRY_SCREENS = ["registry", "feature", "run", "lab", "runs", "samples"] as const;
const REGISTRY_STATES = ["admin", "writer", "empty", "loading", "error", "running"] as const;
const REGISTRY_PAGES: { key: string; picture: string; hash: string; prepare?: PageSetup }[] = [
  ...REGISTRY_SCREENS.flatMap((screen) =>
    REGISTRY_STATES.map((state) => ({
      key: `registry_${screen}_${state}`,
      picture: `ai-registry-${screen}-${state}`,
      hash: `reg-${screen}/${state}`,
    })),
  ),
  // The registry as an admin with its table scrolled to the right end: the Prompt, Status and
  // Example columns, the admin's Change buttons and the example pills, beside the sticky ID and Name.
  {
    key: "registry_registry_admin_scrolled",
    picture: "ai-registry-registry-admin-scrolled",
    hash: "reg-registry/admin",
    prepare: async (page) => {
      const panel = page.locator(".reg-scroll");
      await panel.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      await expect(page.locator("table.reg td:nth-child(8) .pill").first()).toBeInViewport();
    },
  },
];

const PROTOTYPE_PAGES: Gate["prototypePages"] = Object.fromEntries(
  REGISTRY_PAGES.map((target) => [
    target.key,
    { hash: target.hash, file: "aiFeatures" as const, prepare: target.prepare },
  ]),
);

// No live rows: recorded so the inventory (scripts/admin-visual-inventory.mjs) lists the screens.
registerGate({ prototypePages: PROTOTYPE_PAGES, livePages: {}, components: [], exceptions: [] });

// #467: the registry screens have no live page yet. In every state, at both widths, each one's
// frame (page, rail, menu rows, header, title, lede) must match the prototype's own Characters
// screen with the same tolerance as a live page: over 1 px or a different colour fails.
const REGISTRY_FRAME = [
  "page (body / frame)",
  "rail",
  "brand block",
  "brand",
  "brand line (Content admin)",
  "menu group heading",
  "menu row",
  "menu row, current",
  "menu page id",
  "content column",
  "breadcrumb",
  "header row",
  "page title",
  "lede",
];

for (const width of WIDTHS) {
  test(`test_467_registry_prototype_screens_keep_the_prototype_frame_at_${width}_px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    const origin = await startPrototypeServing(page);
    const frame = FRAME_COMPONENTS.filter((component) => REGISTRY_FRAME.includes(component.name));
    expect(frame.map((component) => component.name)).toEqual(REGISTRY_FRAME);

    await openPrototype(page, origin, FRAME_PROTOTYPE_PAGES.characters);
    const reference = new Map<string, Reading>();
    for (const component of frame) {
      reference.set(component.name, await read(page, component, "prototype"));
    }
    const found: string[] = [];
    for (const target of REGISTRY_PAGES) {
      await openPrototype(page, origin, PROTOTYPE_PAGES[target.key]);
      for (const component of frame) {
        found.push(
          ...differences(
            FRAME_GATE,
            `${target.key}: ${component.name}`,
            reference.get(component.name) ?? {},
            await read(page, component, "prototype"),
          ),
        );
      }
    }
    expect(found, `registry screens that leave the prototype frame at ${width} px`).toEqual([]);
  });
}

// #467: the reference pictures of the registry screens, every state, at each width, written as
// ai-registry-<screen>-<state>-<width>.png. Written only on request.
test("test_467_registry_reference_pictures", async ({ page, context }) => {
  picturesOnRequest(600_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    for (const target of REGISTRY_PAGES) {
      await openPrototype(page, origin, PROTOTYPE_PAGES[target.key]);
      writeFileSync(
        path.join(REFERENCE_DIR, `${target.picture}-${width}.png`),
        await page.screenshot({ fullPage: true }),
      );
    }
  }
});
