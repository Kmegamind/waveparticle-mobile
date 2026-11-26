import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAdminCss } from "./support/admin-css";

// #447: ADM-12 Publish history matches the admin prototype's `history` screen.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const PAGE = "src/app/admin/publish-history/page.tsx";

/** Every file under a folder, recursively. */
function filesUnder(folder: string): string[] {
  return readdirSync(path.join(root, folder)).flatMap((name) => {
    const relative = path.join(folder, name);
    return statSync(path.join(root, relative)).isDirectory() ? filesUnder(relative) : [relative];
  });
}

describe("ADM-12 layout as the prototype (#447)", () => {
  it("test_447_ac1_title_and_lede_sit_in_the_header_row", () => {
    const page = read(PAGE);
    expect(page).toContain("<PageHead");
    expect(page).toContain('title="Publish history"');
    // The title is not a loose h1 outside the header row any more.
    expect(page).not.toContain("<h1>Publish history</h1>");
  });

  it("test_447_ac1_the_table_sits_in_a_scrolling_panel_as_the_prototype_panel_scroll", () => {
    expect(read(PAGE)).toContain('<div className="admin-panel admin-scroll">');
  });

  it("test_447_ac1_an_empty_roll_back_status_takes_no_row_height", () => {
    // The prototype's rows are one line (43 px); an empty status line under Roll back or
    // "Published now" made every live row a line taller.
    const css = readAdminCss();
    expect(css).toMatch(
      /\.admin-history-action:has\(> \.admin-text-status:empty\)\s*\{[^}]*gap:\s*0/,
    );
    expect(css).toMatch(
      /\.admin-history-action > \.admin-text-status:empty\s*\{[^}]*min-height:\s*0/,
    );
  });

  it("test_447_ac1_cells_keep_whole_words_as_the_prototype_inside_the_scroll_panel", () => {
    expect(read(PAGE)).toContain('className="admin-table admin-publish-history"');
    expect(readAdminCss()).toMatch(
      /\.admin-publish-history th,\s*\.admin-publish-history td\s*\{\s*overflow-wrap:\s*normal;/,
    );
  });

  it("test_447_ac5_every_function_stays", () => {
    const page = read(PAGE);
    for (const text of ["historyItemName(", "<HistoryRowAction", "canRollBack=", "isCurrent="]) {
      expect(page).toContain(text);
    }
    const action = read("src/app/admin/publish-history/roll-back-button.tsx");
    for (const text of ["Roll back to v", "Published now", "RollBackWarning", 'role="status"']) {
      expect(action).toContain(text);
    }
  });
});

describe("The visual gate's fixed publish history is test-only (#447)", () => {
  it("test_447_ac2_no_production_code_reaches_the_seeded_history_view", () => {
    for (const file of filesUnder("src")) {
      expect(read(file), file).not.toContain("__publish_history");
    }
  });

  it("test_447_ac2_the_gate_reads_its_own_fixed_history", () => {
    // #483: the gate account's seeded views are set up in the gate's shared support file.
    const gate = read("e2e/support/admin-visual.ts");
    expect(gate).toContain("useSeededPublishHistory as seededPublishHistoryView");
    expect(gate).toContain("seededPublishHistoryView(account)");
    expect(read("e2e/support/stub-supabase.mjs")).toContain('path === "/__publish_history"');
  });
});
