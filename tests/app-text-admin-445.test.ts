import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appTextAdminRows,
  appTextCanSave,
  appTextChanges,
  appTextStartText,
  publishAppTextChanges,
  publishChangesMessage,
  type AppTextVersionRow,
} from "@/lib/app-text/admin";
import { APP_TEXT_DEFAULTS } from "@/lib/app-text/catalog";

// #445: the App text page (ADM-07) as the prototype draws it: one line per key, the text edited in
// place, and "Publish changes" in the header (admin only), built on the per-key publish.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const row = (
  key: string,
  version: number,
  body: string,
  published = false,
  publishedAt: string | null = published ? "2026-11-15T10:00:00Z" : null,
): AppTextVersionRow => ({
  key,
  version,
  body,
  published,
  published_at: publishedAt,
  created_at: `2026-11-15T0${version}:00:00Z`,
});

const rowsOf = (versions: AppTextVersionRow[]) =>
  Object.fromEntries(appTextAdminRows(versions).map((item) => [item.key, item]));

function deps(role: "admin" | "writer" | null, failOn: string[] = []) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    deps: {
      userId: role ? "u1" : null,
      role,
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: null, error: failOn.includes(String(args.text_key)) ? { m: "no" } : null };
      },
      clearCache: () => {},
    },
  };
}

describe("editing in place (#445)", () => {
  it("test_445_the_field_starts_with_the_newest_text_exactly", () => {
    const rows = rowsOf([
      row("ui.S1.back", 1, "Back to my Goal", true),
      row("ui.S1.back", 2, "  Back,\nto  my Goal ", false),
      row("ui.F3.fail.retry", 1, "Retry ", true),
    ]);
    // Draft first, then the published text, then the code default; never trimmed or changed.
    expect(appTextStartText(rows["ui.S1.back"])).toBe("  Back,\nto  my Goal ");
    expect(appTextStartText(rows["ui.F3.fail.retry"])).toBe("Retry ");
    expect(appTextStartText(rows["ui.S1.title"])).toBe(APP_TEXT_DEFAULTS["ui.S1.title"]);
  });

  it("test_445_save_draft_is_offered_only_on_an_exact_difference", () => {
    const rows = rowsOf([
      row("ui.S1.back", 1, "Back to my Goal", true),
      row("ui.F3.fail.retry", 1, "Retry", true),
      row("ui.F3.fail.retry", 2, "Retry now", false),
    ]);
    const back = rows["ui.S1.back"];
    expect(appTextCanSave(back, null)).toBe(false);
    expect(appTextCanSave(back, "Back to my Goal")).toBe(false);
    expect(appTextCanSave(back, "Back to my Goal ")).toBe(true);
    expect(appTextCanSave(back, "back to my Goal")).toBe(true);
    // Compared with the draft when there is one.
    expect(appTextCanSave(rows["ui.F3.fail.retry"], "Retry now")).toBe(false);
    expect(appTextCanSave(rows["ui.F3.fail.retry"], "Retry")).toBe(true);
    // A key with no row in the database: saving the default is itself a change to the database.
    expect(appTextCanSave(rows["ui.S1.title"], null)).toBe(true);
  });
});

describe("Publish changes (#445)", () => {
  it("test_445_lists_every_key_with_a_newer_draft_and_its_version", () => {
    const rows = appTextAdminRows([
      row("ui.S1.back", 1, "Back to my Goal", true),
      row("ui.S1.back", 2, "Back to my Step", false),
      row("ui.F3.fail.retry", 1, "Retry", true),
      // Published before and rolled back past: an earlier version, not a change.
      row("ui.R1.fail.retry", 1, "Retry", true),
      row("ui.R1.fail.retry", 2, "Try again", false, "2026-11-15T11:00:00Z"),
      row("ui.S1.title", 3, "Outside the story", false),
    ]);
    expect(appTextChanges(rows)).toEqual([
      { key: "ui.S1.title", version: 3, body: "Outside the story" },
      { key: "ui.S1.back", version: 2, body: "Back to my Step" },
    ]);
  });

  it("test_445_only_an_admin_may_publish_changes_and_nothing_is_written_otherwise", async () => {
    for (const role of ["writer", null] as const) {
      const d = deps(role);
      expect(await publishAppTextChanges([{ key: "ui.S1.back", version: 2 }], d.deps)).toEqual({
        ok: false,
        error: "not-allowed",
      });
      expect(d.calls).toEqual([]);
    }
  });

  it("test_445_publishes_each_listed_version_through_the_per_key_publish", async () => {
    const d = deps("admin", ["ui.S1.title"]);
    const result = await publishAppTextChanges(
      [
        { key: "ui.S1.back", version: 2 },
        { key: "ui.S1.title", version: 3 },
      ],
      d.deps,
    );
    expect(d.calls).toEqual([
      { name: "publish_app_text", args: { text_key: "ui.S1.back", text_version: 2 } },
      { name: "publish_app_text", args: { text_key: "ui.S1.title", text_version: 3 } },
    ]);
    expect(result).toEqual({
      ok: true,
      results: [
        { key: "ui.S1.back", version: 2, result: { ok: true } },
        { key: "ui.S1.title", version: 3, result: { ok: false, error: "failed" } },
      ],
    });
    if (!result.ok) throw new Error("expected results");
    expect(publishChangesMessage(result.results)).toBe(
      "Published ui.S1.back v2. Not published: ui.S1.title v3 (Could not save the change. Please try again.).",
    );
  });

  it("test_445_refuses_an_empty_repeated_or_malformed_list", async () => {
    for (const list of [
      [],
      [
        { key: "ui.S1.back", version: 2 },
        { key: "ui.S1.back", version: 3 },
      ],
      [{ key: "ui.S1.back", version: 1.5 }],
      "ui.S1.back",
    ]) {
      const d = deps("admin");
      expect(await publishAppTextChanges(list as never, d.deps)).toEqual({
        ok: false,
        error: "invalid",
      });
      expect(d.calls).toEqual([]);
    }
  });

  it("test_445_the_action_checks_the_role_on_the_server", () => {
    const source = read("src/app/admin/app-text/actions.ts");
    expect(source).toMatch(/export async function publishAppTextChangesAction/);
    expect(source).toContain("publishAppTextChanges(");
    expect(source).toContain("readContentRole(client)");
  });
});

describe("the page follows the prototype (#445)", () => {
  it("test_445_one_line_per_key_with_the_header_action", () => {
    const page = read("src/app/admin/app-text/page.tsx");
    expect(page).toContain("<PageHead");
    expect(page).toContain("PublishChanges");
    const editor = read("src/app/admin/app-text/app-text-editor.tsx");
    // The text is edited in place, as the prototype's contenteditable cell; no text box in the row.
    expect(editor).toContain("contentEditable");
    expect(editor).not.toContain("<textarea");
    // Every function stays (#313): draft, publish per key, versions and roll back.
    for (const text of ["Save draft", "Publish v", "Versions (", "Roll back to v"]) {
      expect(editor).toContain(text);
    }
  });
});
