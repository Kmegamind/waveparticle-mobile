import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #313: at desktop widths the admin looks like the admin prototype. The expected values are the
// computed styles of content-admin/admin-prototype_2026-11-14_v1.html at 1280 px (light theme).

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

const style = (
  page: Page,
  selector: string,
  properties: string[],
): Promise<Record<string, string | number>> =>
  page
    .locator(selector)
    .first()
    .evaluate((element, names) => {
      const computed = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        ...Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name)])),
        width: Math.round(box.width),
      };
    }, properties);

test("test_313_the_shell_has_the_prototype_computed_styles", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  await expect(page.getByRole("heading", { level: 1, name: "Companions" })).toBeVisible();

  expect(
    await style(page, ".admin-shell", ["background-color", "color", "font-size", "min-width"]),
  ).toMatchObject({
    "background-color": "rgb(245, 246, 244)",
    color: "rgb(29, 36, 33)",
    "font-size": "14px",
    "min-width": "1024px",
  });
  expect(
    await style(page, ".admin-rail", ["background-color", "border-right-color", "padding"]),
  ).toMatchObject({
    "background-color": "rgb(255, 255, 255)",
    "border-right-color": "rgb(221, 226, 223)",
    padding: "18px 12px",
    width: 232,
  });
  expect(
    await style(page, '.admin-menu-link[aria-current="page"]', [
      "background-color",
      "color",
      "font-size",
      "font-weight",
      "padding",
      "border-radius",
    ]),
  ).toMatchObject({
    "background-color": "rgb(226, 240, 235)",
    color: "rgb(31, 111, 92)",
    "font-size": "14px",
    "font-weight": "600",
    padding: "6px 8px",
    "border-radius": "6px",
  });
  expect(
    await style(page, ".admin-group-heading", ["font-size", "text-transform", "color"]),
  ).toMatchObject({
    "font-size": "10.5px",
    "text-transform": "uppercase",
    color: "rgb(95, 107, 102)",
  });
  const title = await style(page, ".admin-main h1", ["font-size", "font-weight", "font-family"]);
  expect(title).toMatchObject({ "font-size": "26px", "font-weight": "600" });
  expect(title["font-family"]).toMatch(/^"?Fraunces"?, Georgia, serif$/);
  expect(await style(page, ".admin-crumb", ["font-size", "color"])).toMatchObject({
    "font-size": "12px",
    color: "rgb(95, 107, 102)",
  });
  expect(
    await style(page, ".admin-sign-out", ["font-size", "border-radius", "padding", "min-height"]),
  ).toMatchObject({
    "font-size": "12px",
    "border-radius": "7px",
    padding: "3px 9px",
    "min-height": "0px",
  });
});

test("test_313_a_table_has_the_prototype_computed_styles", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const table = page.getByRole("table", { name: "Companions" });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Character",
    "Mode",
    "Stories",
    "Shown to users",
    "Last change",
  ]);

  expect(
    await style(page, ".admin-panel", [
      "border-radius",
      "border-top-color",
      "padding",
      "background-color",
    ]),
  ).toMatchObject({
    "border-radius": "10px",
    "border-top-color": "rgb(221, 226, 223)",
    padding: "16px",
    "background-color": "rgb(255, 255, 255)",
  });
  expect(
    await style(page, ".admin-table th", [
      "font-size",
      "font-weight",
      "text-transform",
      "letter-spacing",
      "color",
      "padding",
      "border-bottom-color",
    ]),
  ).toMatchObject({
    "font-size": "11px",
    "font-weight": "500",
    "text-transform": "uppercase",
    "letter-spacing": "0.66px",
    color: "rgb(95, 107, 102)",
    padding: "8px 10px",
    "border-bottom-color": "rgb(221, 226, 223)",
  });
  expect(await style(page, ".admin-table td", ["padding"])).toMatchObject({ padding: "8px 10px" });
  expect(
    await style(page, ".admin-chip", ["font-size", "background-color", "border-radius", "padding"]),
  ).toMatchObject({
    "font-size": "11.5px",
    "background-color": "rgb(238, 241, 239)",
    "border-radius": "4px",
    padding: "1px 6px",
  });
  expect(
    await style(page, ".admin-pill-published", ["background-color", "color", "border-radius"]),
  ).toMatchObject({
    "background-color": "rgb(227, 242, 232)",
    color: "rgb(47, 125, 79)",
    "border-radius": "99px",
  });
});

test("test_313_no_sideways_scroll_at_1024_and_1280_px", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/admin/companions", "/admin/app-text", "/admin/publish-history"]) {
      await page.goto(path);
      await expect(page.getByText("Content admin", { exact: true })).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} at ${width}`).toBeLessThanOrEqual(width);
    }
  }
});
