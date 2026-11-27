import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AiFeatureRow } from "@/lib/ai-features/admin";
import {
  changeFeatureStatus,
  editedSection,
  lastSave,
  personName,
  saveFeatureSections,
  statusHistory,
  type FeatureDeps,
  type StatusHistoryRow,
} from "@/lib/ai-features/edit";

// #453 (part of #430 T6; AI-PAGE-EDIT): writers and admins edit (a) purpose, (b) pass questions and
// (c) current approach; only an admin changes the status, and every change is kept with who, when,
// from, to and a note. The pages are checked in e2e/ai-features.spec.ts and against the drawing in
// e2e/admin-visual-ai-features.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = "20261201000000_ai_feature_people.sql";
const sql = () => read(`supabase/migrations/${MIGRATION}`).replace(/--.*$/gm, "");

const feature = (over: Partial<AiFeatureRow> = {}): AiFeatureRow => ({
  slug: "rest_reply",
  position: 4,
  title: "Rest reply (rest_reply)",
  prompt_keys: ["rest_reply"],
  purpose: [
    { text: "Draft purpose.", source: "docs/PRD.md:10", draft: true },
    { text: "Second line.", source: "docs/PRD.md:11", draft: true },
  ],
  pass_questions: [{ text: "Is it short?", source: "docs/ai/AI_04.md:3", draft: true }],
  approach: [],
  status: "exploring",
  created_at: "2026-11-25T00:00:00Z",
  sections_updated_at: null,
  sections_updated_by: null,
  ...over,
});

function deps(over: Partial<FeatureDeps> = {}): FeatureDeps & { rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  return {
    userId: "u-1",
    role: "writer",
    readFeature: async () => feature(),
    rpc,
    ...over,
  } as FeatureDeps & { rpc: ReturnType<typeof vi.fn> };
}

describe("who changed a feature: the migration (#453)", () => {
  it("test_453_the_migration_runs_after_the_ai_feature_tables", () => {
    const names = readdirSync(path.join(root, "supabase", "migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    // Was "the latest migration"; #473 adds the AI registry after it, which needs this function's
    // tables, #476 the run log, #475 the registry editor (which replaces this function with a
    // wider list of people) and #479 the sample library. It must still run after the AI feature
    // tables.
    expect(names.slice(names.indexOf(MIGRATION) + 1)).toEqual([
      "20261202000000_ai_registry.sql",
      "20261203000000_ai_runs.sql",
      "20261204000000_ai_registry_editing.sql",
      "20261205000000_ai_samples.sql",
    ]);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261130000000_ai_features.sql"),
    );
  });

  it("test_453_emails_of_the_features_editors_for_content_editors_only", () => {
    const code = sql();
    expect(code).toMatch(/create function public\.list_ai_feature_people\(target_feature text\)/);
    expect(code).toMatch(/security definer\s+set search_path = ''/);
    expect(code).toMatch(/if not public\.is_content_editor\(\) then\s+raise exception[^;]+'42501'/);
    expect(code).toMatch(
      /from public\.ai_feature_status_history h\s+where h\.feature_slug = target_feature/,
    );
    expect(code).toMatch(/from public\.ai_features f\s+where f\.slug = target_feature/);
    expect(code).toMatch(
      /revoke all on function public\.list_ai_feature_people\(text\) from public, anon, authenticated;/,
    );
    expect(code).toMatch(
      /grant execute on function public\.list_ai_feature_people\(text\) to authenticated;/,
    );
  });

  it("test_453_the_migration_only_adds_a_read_function", () => {
    const code = sql();
    expect(code).not.toMatch(/\b(insert into|update|delete from|alter table|drop|create table)\b/i);
    expect(code).not.toMatch(/create or replace/);
  });
});

describe("saving (a) to (c) (#453 AC1)", () => {
  it("test_453_ac1_a_saved_item_loses_the_draft_label_and_keeps_its_source", () => {
    const current = feature().purpose;
    expect(
      editedSection(current, [
        { from: 1, text: "  Second line, edited. " },
        { from: 0, text: "Draft purpose." },
        { from: null, text: "A new line." },
      ]),
    ).toEqual([
      { text: "Second line, edited.", source: "docs/PRD.md:11", draft: false },
      { text: "Draft purpose.", source: "docs/PRD.md:10", draft: false },
      { text: "A new line.", source: null, draft: false },
    ]);
  });

  it("test_453_ac1_an_emptied_box_removes_its_line_and_no_line_is_not_written_yet", () => {
    expect(editedSection(feature().purpose, [{ from: 0, text: "   " }])).toEqual([]);
    expect(editedSection([], [])).toEqual([]);
  });

  it("test_453_ac1_a_source_never_comes_from_the_browser", () => {
    expect(editedSection(feature().purpose, [{ from: 7, text: "x" }])).toBeNull();
    expect(editedSection(feature().purpose, [{ from: 0.5, text: "x" }])).toBeNull();
    expect(
      editedSection(feature().purpose, [
        { from: null, text: "x", source: "made up" } as unknown as { from: null; text: string },
      ]),
    ).toEqual([{ text: "x", source: null, draft: false }]);
  });

  it("test_453_ac1_a_writer_saves_one_editor_and_the_other_sections_stay_as_they_are", async () => {
    const d = deps();
    const result = await saveFeatureSections(
      {
        slug: "rest_reply",
        loadedAt: null,
        sections: { purpose: [{ from: 0, text: "Owner purpose." }] },
      },
      d,
    );
    expect(result).toEqual({ ok: true });
    expect(d.rpc).toHaveBeenCalledWith("save_ai_feature_sections", {
      target_feature: "rest_reply",
      new_purpose: [{ text: "Owner purpose.", source: "docs/PRD.md:10", draft: false }],
      // Not on this editor: sent back unchanged, still drafts.
      new_pass_questions: feature().pass_questions,
      new_approach: [],
    });
  });

  it("test_453_ac1_admins_and_writers_save_others_cannot", async () => {
    for (const over of [{ userId: null }, { role: null }] as Partial<FeatureDeps>[]) {
      const d = deps(over);
      expect(
        await saveFeatureSections({ slug: "rest_reply", loadedAt: null, sections: {} }, d),
      ).toEqual({ ok: false, error: "not-allowed" });
      expect(d.rpc).not.toHaveBeenCalled();
    }
    const admin = deps({ role: "admin" });
    expect(
      await saveFeatureSections({ slug: "rest_reply", loadedAt: null, sections: {} }, admin),
    ).toEqual({ ok: true });
  });

  it("test_453_ac1_a_save_over_someone_elses_newer_save_is_refused", async () => {
    const d = deps({
      readFeature: async () => feature({ sections_updated_at: "2026-11-25T10:00:00Z" }),
    });
    expect(
      await saveFeatureSections(
        { slug: "rest_reply", loadedAt: null, sections: { approach: [] } },
        d,
      ),
    ).toEqual({ ok: false, error: "changed-since" });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_453_ac1_bad_input_and_database_refusals_read_plainly", async () => {
    expect(
      await saveFeatureSections(
        {
          slug: "rest_reply",
          loadedAt: null,
          sections: { purpose: [{ from: null, text: "x".repeat(2001) }] },
        },
        deps(),
      ),
    ).toEqual({ ok: false, error: "too-long" });
    expect(
      await saveFeatureSections({ slug: "Bad slug", loadedAt: null, sections: {} }, deps()),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await saveFeatureSections(
        { slug: "rest_reply", loadedAt: null, sections: {} },
        deps({ readFeature: async () => undefined }),
      ),
    ).toEqual({ ok: false, error: "unknown-feature" });
    const refused = deps();
    refused.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(
      await saveFeatureSections({ slug: "rest_reply", loadedAt: null, sections: {} }, refused),
    ).toEqual({ ok: false, error: "not-allowed" });
  });
});

describe("the status (#453 AC2, AC4)", () => {
  it("test_453_ac4_a_writer_never_reaches_set_ai_feature_status", async () => {
    const d = deps({ role: "writer" });
    expect(
      await changeFeatureStatus({ slug: "rest_reply", status: "passed", note: "" }, d),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_453_ac4_the_database_refusal_of_a_writer_reads_as_not_allowed", async () => {
    // Even when the page thought the account was an admin (the role changed meanwhile), the
    // function's own check decides.
    const d = deps({ role: "admin" });
    d.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(
      await changeFeatureStatus({ slug: "rest_reply", status: "passed", note: "" }, d),
    ).toEqual({ ok: false, error: "not-allowed" });
  });

  it("test_453_ac2_an_admin_changes_the_status_with_an_optional_note", async () => {
    const d = deps({ role: "admin" });
    expect(
      await changeFeatureStatus(
        { slug: "rest_reply", status: "passed", note: "  Read 10 replies " },
        d,
      ),
    ).toEqual({ ok: true });
    expect(d.rpc).toHaveBeenCalledWith("set_ai_feature_status", {
      target_feature: "rest_reply",
      new_status: "passed",
      change_note: "Read 10 replies",
    });
    const blank = deps({ role: "admin" });
    await changeFeatureStatus({ slug: "rest_reply", status: "frozen", note: " " }, blank);
    expect(blank.rpc).toHaveBeenCalledWith("set_ai_feature_status", {
      target_feature: "rest_reply",
      new_status: "frozen",
      change_note: null,
    });
  });

  it("test_453_ac2_same_status_unknown_status_and_long_note_are_refused_before_the_database", async () => {
    const d = deps({ role: "admin" });
    expect(
      await changeFeatureStatus({ slug: "rest_reply", status: "exploring", note: "" }, d),
    ).toEqual({ ok: false, error: "unchanged" });
    expect(await changeFeatureStatus({ slug: "rest_reply", status: "done", note: "" }, d)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      await changeFeatureStatus({ slug: "rest_reply", status: "passed", note: "x".repeat(501) }, d),
    ).toEqual({ ok: false, error: "note-too-long" });
    expect(d.rpc).not.toHaveBeenCalled();
  });
});

describe("the status history (#453 AC3)", () => {
  const people = new Map([["u-admin", "admin@example.invalid"]]);
  const row = (over: Partial<StatusHistoryRow>): StatusHistoryRow => ({
    id: 1,
    feature_slug: "rest_reply",
    from_status: "exploring",
    to_status: "passed",
    note: null,
    changed_by: "u-admin",
    changed_at: "2026-11-25T20:15:00Z",
    ...over,
  });

  it("test_453_ac3_who_when_from_to_and_note_newest_first_then_the_setup", () => {
    const entries = statusHistory(
      feature({ status: "frozen" }),
      [
        row({ id: 1 }),
        row({
          id: 2,
          from_status: "passed",
          to_status: "frozen",
          note: "Stable",
          changed_at: "2026-11-26T08:00:00Z",
          changed_by: "u-gone-1234567890",
        }),
      ],
      people,
    );
    expect(entries).toEqual([
      {
        key: "2",
        time: "2026-11-26 08:00",
        dateTime: "2026-11-26T08:00:00Z",
        person: "Account u-gone-1",
        from: "passed",
        to: "frozen",
        note: "Stable",
      },
      {
        key: "1",
        time: "2026-11-25 20:15",
        dateTime: "2026-11-25T20:15:00Z",
        person: "admin@example.invalid",
        from: "exploring",
        to: "passed",
        note: null,
      },
      {
        key: "setup",
        time: "2026-11-25 00:00",
        dateTime: "2026-11-25T00:00:00Z",
        person: "Setup",
        from: null,
        to: "exploring",
        note: "Every status starts as Exploring",
      },
    ]);
  });

  it("test_453_ac3_people_read_as_on_publish_history", () => {
    expect(personName("u-1", "a@example.invalid")).toBe("a@example.invalid");
    expect(personName("0123456789abcdef", null)).toBe("Account 01234567");
    expect(personName(null, null)).toBe("Deleted account");
    // Publish history uses the same words.
    expect(read("src/lib/publish-history/admin.ts")).toContain(
      "personName(row.acted_by, row.acted_by_email)",
    );
  });

  it("test_453_ac3_with_no_change_the_history_is_the_setup_row", () => {
    expect(statusHistory(feature(), [], people).map((entry) => entry.person)).toEqual(["Setup"]);
  });

  it("test_453_ac1_the_last_save_says_when_and_who", () => {
    expect(lastSave(feature(), people)).toBeNull();
    expect(
      lastSave(
        feature({ sections_updated_at: "2026-11-25T09:30:00Z", sections_updated_by: "u-admin" }),
        people,
      ),
    ).toEqual({
      time: "2026-11-25 09:30",
      dateTime: "2026-11-25T09:30:00Z",
      person: "admin@example.invalid",
    });
  });
});
