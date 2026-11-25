import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { menuCurrent } from "@/app/admin/menu-current";

// #435: the admin frame follows the admin prototype: its fonts, its 8 px page margin, its header
// action row and the current menu row on detail pages. The look itself is checked against the
// prototype by e2e/admin-visual.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("admin frame (#435)", () => {
  it("test_435_ac1_the_admin_loads_the_prototype_fonts_through_next_font", () => {
    const fonts = read("src/app/admin/fonts.ts");
    expect(fonts).toContain('from "next/font/google"');
    for (const name of ["Fraunces(", "IBM_Plex_Sans(", "IBM_Plex_Mono("]) {
      expect(fonts).toContain(name);
    }
    expect(fonts).toContain('weight: ["400", "500", "600"]');
    expect(fonts).toContain('weight: ["400", "500"]');
    expect(fonts).toContain('axes: ["opsz"]');
    // Admin only: the root layout does not load them.
    expect(read("src/app/fonts.ts")).not.toMatch(/Fraunces|IBM_Plex/);
    expect(read("src/app/admin/layout.tsx")).toContain("fontClassName={adminFontVariables}");
  });

  it("test_435_ac2_the_page_margin_is_8_px_through_a_token", () => {
    expect(read("src/app/tokens.css")).toContain("--adm-page-margin: 8px;");
    const css = read("src/app/globals.css");
    const start = css.indexOf(".admin-shell {");
    expect(css.slice(start, css.indexOf("}", start))).toContain("padding: var(--adm-page-margin)");
  });

  it("test_435_ac3_the_header_has_an_action_row", () => {
    const ui = read("src/app/admin/admin-ui.tsx");
    expect(ui).toContain("export function PageHead");
    expect(ui).toContain('className="admin-head"');
    expect(ui).toContain('className="admin-actions"');
  });

  it("test_435_ac4_detail_pages_mark_their_menu_row", () => {
    expect(menuCurrent("/admin/prompts", "/admin/prompts")).toBe("page");
    expect(menuCurrent("/admin/prompts/plan_split", "/admin/prompts")).toBe("true");
    expect(
      menuCurrent("/admin/companions/oppenheimer/stories/site-search", "/admin/companions"),
    ).toBe("true");
    expect(menuCurrent("/admin/stories/site-search", "/admin/stories")).toBe("true");
    expect(menuCurrent("/admin/prompts", "/admin/publish-history")).toBeUndefined();
    // A path that only starts with the same letters is not inside the page.
    expect(menuCurrent("/admin/prompts-old", "/admin/prompts")).toBeUndefined();
  });
});
