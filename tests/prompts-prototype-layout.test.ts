import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { savedText, versionDay } from "@/lib/admin/prompt-text";

// #446: the ADM-08 Prompts pages in the prototype's layout, and the editor never changing text
// the user did not change.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Save draft keeps the stored text exactly (#446)", () => {
  it("test_446_an_untouched_field_sends_the_stored_text_itself", () => {
    expect(savedText("a\nb", "a\nb")).toEqual({ text: "a\nb", changed: false });
    // A text field shows Windows line ends as \n; the stored text goes back unchanged.
    expect(savedText("a\r\nb\r\n", "a\nb\n")).toEqual({ text: "a\r\nb\r\n", changed: false });
    expect(savedText("  lead\n\ntrail  ", "  lead\n\ntrail  ")).toEqual({
      text: "  lead\n\ntrail  ",
      changed: false,
    });
  });

  it("test_446_an_edited_field_keeps_windows_line_ends_on_the_lines_not_touched", () => {
    expect(savedText("a\r\nb", "a\nb\nc")).toEqual({ text: "a\r\nb\r\nc", changed: true });
    expect(savedText("a\nb", "a\nb\nc")).toEqual({ text: "a\nb\nc", changed: true });
    // Mixed line ends: the typed text as it is.
    expect(savedText("a\r\nb\nc", "a\nb\nc\nd")).toEqual({ text: "a\nb\nc\nd", changed: true });
  });

  it("test_446_any_difference_counts_even_spaces", () => {
    expect(savedText("a", "a ").changed).toBe(true);
    expect(savedText("a", "").changed).toBe(true);
  });

  it("test_446_version_day_is_the_utc_month_and_day", () => {
    expect(versionDay("2026-11-25T23:59:00Z")).toBe("11-25");
    expect(versionDay("2026-01-02T00:00:00+00:00")).toBe("01-02");
    expect(versionDay("not a date")).toBe("");
  });

  it("test_446_save_draft_skips_the_server_when_nothing_changed", () => {
    const editor = read("src/app/admin/prompts/[key]/prompt-editor.tsx");
    expect(editor).toContain("savedText(");
    expect(editor).toContain('PROBLEMS["unchanged"]');
    // Read from the fields themselves, not FormData (whose line ends can differ).
    expect(editor).not.toContain("new FormData(");
  });
});

describe("ADM-08 Prompts in the prototype's layout (#446)", () => {
  it("test_446_detail_uses_the_header_row_and_two_columns", () => {
    const page = read("src/app/admin/prompts/[key]/page.tsx");
    const editor = read("src/app/admin/prompts/[key]/prompt-editor.tsx");
    expect(page + editor).toContain("<PageHead");
    expect(editor).toContain('actionsLabel="Prompt actions"');
    expect(read("src/app/admin/admin-ui.tsx")).toContain(
      'role={actionsLabel ? "group" : undefined}',
    );
    expect(editor).toContain('className="admin-prompt-grid"');
    expect(editor).toContain('aria-label="Versions"');
  });

  it("test_446_roll_back_in_versions_is_admin_only_and_only_for_an_earlier_version", () => {
    const editor = read("src/app/admin/prompts/[key]/prompt-editor.tsx");
    expect(editor).toContain("rollBackPromptAction(");
    expect(editor).toMatch(/isAdmin && version\.state === "earlier"/);
  });

  it("test_446_list_is_a_table_in_a_panel", () => {
    const page = read("src/app/admin/prompts/page.tsx");
    expect(page).toContain('className="admin-panel"');
    expect(page).toContain('className="admin-table admin-prompt-list"');
    expect(page).toContain('aria-label="Prompts"');
  });

  it("test_446_prompt_text_wraps_long_tokens", () => {
    const css = read("src/app/globals.css");
    const block = css.slice(css.indexOf("/* Issue 446"));
    expect(block).toMatch(/\.admin-prompt-code[^}]*overflow-wrap: anywhere/);
  });

  it("test_446_no_model_is_called_from_the_prompt_pages", () => {
    for (const file of [
      "src/app/admin/prompts/page.tsx",
      "src/app/admin/prompts/[key]/page.tsx",
      "src/app/admin/prompts/[key]/prompt-editor.tsx",
      "src/app/admin/prompts/actions.ts",
    ]) {
      expect(read(file), file).not.toMatch(/createModelGateway|callModel|MODEL_API/);
    }
  });
});
