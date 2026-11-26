import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { companionRow } from "@/lib/admin/companion-rows";
import { readAdminCss } from "./support/admin-css";

// #441: the Companions list (ADM-03) follows the prototype's Characters screen. Each row is
// clickable with the name in bold text (no underlined link look); the panel scrolls sideways as
// the prototype's `.panel.scroll` does. "New character" is not built (nothing creates a Companion
// yet, #339 is Later) and "Not ready" stays (it is not the prototype's "Draft"): both are owner
// decisions in the pull request.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const page = () => read("src/app/admin/companions/page.tsx");
const block = (selector: string) => {
  const css = readAdminCss();
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
};

describe("Companions list matches the prototype (#441)", () => {
  it("test_441_each_row_is_clickable_with_the_name_as_bold_text", () => {
    expect(page()).toContain('className="admin-row-click"');
    expect(page()).toContain('className="admin-row-link"');
    expect(page()).not.toContain("admin-cell-name");
    // The name stays a real link, so the keyboard and screen readers still open the Companion.
    expect(page()).toContain("href={`/admin/companions/${companion.id}`}");

    const link = block(".admin-row-link");
    expect(link).toContain("font-weight: 700;");
    expect(link).toContain("text-decoration: none;");
    // The link covers its whole row, so a click anywhere on the row opens the Companion.
    expect(block(".admin-row-link::after")).toContain("position: absolute;");
    expect(block(".admin-row-click")).toContain("position: relative;");
    expect(block(".admin-row-click")).toContain("cursor: pointer;");
    expect(block(".admin-row-click:hover td")).toContain("background: var(--adm-soft);");
  });

  it("test_441_the_panel_scrolls_sideways_like_the_prototype", () => {
    expect(page()).toContain('className="admin-panel admin-panel-scroll"');
    expect(block(".admin-panel-scroll")).toContain("overflow-x: auto;");
  });

  it("test_441_no_new_character_button_without_a_way_to_create_one", () => {
    expect(page()).not.toMatch(/New character/);
    expect(page()).not.toContain("actions=");
  });

  it("test_441_a_companion_without_stories_stays_not_ready", () => {
    // The prototype's "Draft" means a character not yet published; the app has no such state for a
    // Companion. "Not ready" means phones cannot open him (no story), so the word stays.
    expect(companionRow({ id: "moriarty", key_code: "mor" }, [], []).shown).toBe("Not ready");
  });

  it("test_441_the_visual_gate_compares_the_companion_rows_with_no_exception", () => {
    // #483: the Companions rows of the visual gate are in their own file.
    const spec = read("e2e/admin-visual-companions.spec.ts");
    expect(spec).not.toContain("Companion name link");
    for (const name of [
      '"Companion name"',
      '"clickable row"',
      '"pill (Draft)"',
      '"panel that scrolls sideways"',
      "test_441_hovered_companion_row_matches_the_prototype_at_",
    ]) {
      expect(spec, name).toContain(name);
    }
  });
});
