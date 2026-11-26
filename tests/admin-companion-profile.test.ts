import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { companionPage } from "@/lib/content-fields/pages";
import {
  changedFields,
  fieldPill,
  publishPlan,
  saveSummary,
  startText,
} from "@/lib/content-fields/profile";
import type { FieldView } from "@/lib/content-fields/view";

// #442: the Companion profile page as the admin prototype draws it (ADM-04): tabs, one row per
// field with its id and its state pill, and one Save draft and one Publish in the header. Every
// field keeps its own versions: Save draft makes a draft of each changed field, Publish publishes
// each field's draft.

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const view = (
  key: string,
  shown: string,
  draft?: { version: number; body: string },
): FieldView => ({
  key,
  shown,
  draft: draft ?? null,
  versions: [],
});

describe("Companion profile fields (#442)", () => {
  it("test_442_each_field_has_a_pill_that_says_its_state", () => {
    expect(fieldPill(view("chr.opp.name", "J. Robert Oppenheimer"))).toEqual({
      state: "published",
      label: "Published",
    });
    expect(fieldPill(view("chr.opp.name", "Old", { version: 3, body: "New" }))).toEqual({
      state: "draft",
      label: "Draft v3",
    });
    // Nothing shown and no draft: not "Published".
    expect(fieldPill(view("chr.opp.who", ""))).toEqual({ state: "earlier", label: "Not written" });
  });

  it("test_442_the_editor_starts_from_the_draft_else_the_text_shown_now", () => {
    expect(startText(view("chr.opp.tags", "A · B"))).toBe("A · B");
    expect(startText(view("chr.opp.tags", "A · B", { version: 2, body: "C" }))).toBe("C");
  });

  it("test_442_save_draft_takes_only_the_fields_whose_text_changed", () => {
    const views = [
      view("chr.opp.name", "Name"),
      view("chr.opp.tags", "Tags", { version: 2, body: "New tags" }),
      view("chr.opp.who", ""),
    ];
    // Spaces around a text are not part of it (#317); a field never typed in is unchanged.
    expect(
      changedFields(views, { "chr.opp.name": " Name ", "chr.opp.tags": "Tags", "chr.opp.who": "" }),
    ).toEqual([{ key: "chr.opp.tags", text: "Tags" }]);
    expect(changedFields(views, { "chr.opp.who": "I am" })).toEqual([
      { key: "chr.opp.who", text: "I am" },
    ]);
    expect(changedFields(views, {})).toEqual([]);
  });

  it("test_442_publish_takes_every_saved_draft_and_only_an_admin_publishes", () => {
    const views = [
      view("chr.opp.name", "Name", { version: 2, body: "New" }),
      view("chr.opp.tags", "Tags"),
      view("chr.opp.period.4", "After the war", { version: 5, body: "Later" }),
    ];
    expect(publishPlan("admin", views, 0)).toEqual({
      ok: true,
      drafts: [
        { key: "chr.opp.name", version: 2 },
        { key: "chr.opp.period.4", version: 5 },
      ],
    });
    expect(publishPlan("writer", views, 0)).toEqual({
      ok: false,
      reason: "Only an admin can publish. Ask an admin to publish the drafts.",
    });
    // A changed text that is not saved yet is never published by mistake.
    expect(publishPlan("admin", views, 1)).toEqual({
      ok: false,
      reason: "Save draft first: 1 changed field is not saved yet.",
    });
    expect(publishPlan("admin", views, 2)).toEqual({
      ok: false,
      reason: "Save draft first: 2 changed fields are not saved yet.",
    });
    expect(publishPlan("admin", [view("chr.opp.tags", "Tags")], 0)).toEqual({
      ok: false,
      reason: "Nothing to publish: no field has a draft.",
    });
  });

  it("test_442_the_header_status_counts_what_was_done", () => {
    expect(saveSummary("save", 0, 0)).toBe("Nothing changed, so nothing was saved.");
    expect(saveSummary("save", 1, 0)).toBe(
      "Saved 1 draft. The app still shows the published text.",
    );
    expect(saveSummary("save", 2, 1)).toBe(
      "Saved 2 drafts. The app still shows the published text. 1 field was not saved; see the field.",
    );
    expect(saveSummary("publish", 2, 0)).toBe("Published 2 fields.");
    expect(saveSummary("publish", 0, 2)).toBe("2 fields were not published; see each field.");
  });

  it("test_442_the_page_has_the_one_line_of_the_companions_screen", () => {
    const page = companionPage(
      {
        id: "oppenheimer",
        position: 1,
        name: "J. Robert Oppenheimer",
        short_name: "Oppenheimer",
        tags: "Brilliant",
        who: "",
        line: "I can give you the answer.",
        key_code: "opp",
        mode: "historical",
      },
      [],
      [],
    );
    expect(page.oneLine).toEqual({
      label: "One line (Companions)",
      key: "chr.opp.line",
      text: "I can give you the answer.",
    });
    expect(page.profile.map((entry) => entry.label)).toEqual(["Name", "Tags", "Who I am"]);
  });

  it("test_442_the_page_uses_tabs_field_rows_and_the_header_actions", () => {
    const page = read("src/app/admin/companions/[id]/page.tsx");
    const fields = read("src/app/admin/companions/[id]/profile-fields.tsx");
    expect(fields).toContain("<PageHead");
    expect(fields).toContain('role="tablist"');
    expect(fields).toContain('className="admin-fields"');
    expect(fields).toContain("<StatePill");
    // One Save draft and one Publish for the page; no editor panel per field any more.
    expect(page).not.toContain("<FieldEditor");
    expect(fields).not.toContain("<FieldEditor");
  });
});
