import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUBLISH_HISTORY_LIMIT,
  formatHistoryTime,
  publishHistoryEntries,
  readPublishHistory,
  rollBackHistoryItem,
  type PublishHistoryRow,
} from "@/lib/publish-history/admin";
import { appTextAdminRows, type AppTextVersionRow } from "@/lib/app-text/admin";

// #289: ADM-12 Publish history, its rows and its Roll back button; and the #288 label fix.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const history = (overrides: Partial<PublishHistoryRow>): PublishHistoryRow => ({
  id: 1,
  kind: "app_text",
  item_key: "ui.S1.back",
  version: 1,
  action: "publish",
  acted_by: "0f3a9c21-7d44-4a1e-9a55-1b2c3d4e5f60",
  acted_by_email: "writer@example.com",
  acted_at: "2026-11-15T10:04:00Z",
  is_current: false,
  ...overrides,
});

describe("ADM-12 rows (#289)", () => {
  it("test_289_ac2_lists_newest_first_with_person_time_kind_key_version_and_action", () => {
    const entries = publishHistoryEntries([
      history({ id: 1, acted_at: "2026-11-15T09:00:00Z", version: 2 }),
      history({
        id: 3,
        acted_at: "2026-11-15T11:30:00Z",
        version: 1,
        action: "roll_back",
        is_current: true,
      }),
      history({ id: 2, acted_at: "2026-11-15T11:30:00Z", version: 3 }),
    ]);
    expect(entries.map((entry) => entry.id)).toEqual([3, 2, 1]);
    expect(entries[0]).toMatchObject({
      kind: "app_text",
      kindLabel: "App text",
      key: "ui.S1.back",
      version: 1,
      actionLabel: "Rolled back",
      person: "writer@example.com",
      time: "15 Nov 2026, 11:30 UTC",
      dateTime: "2026-11-15T11:30:00Z",
      isCurrent: true,
      canRollBack: false,
    });
    expect(entries[1]).toMatchObject({ actionLabel: "Published", canRollBack: true });
  });

  it("test_289_ac2_roll_back_is_hidden_on_the_version_published_now_and_unknown_kinds", () => {
    const entries = publishHistoryEntries([
      history({ id: 1, is_current: true }),
      history({ id: 2, is_current: false }),
      history({ id: 3, kind: "character", is_current: false }),
    ]);
    expect(entries.map((entry) => [entry.id, entry.canRollBack])).toEqual([
      [3, false],
      [2, true],
      [1, false],
    ]);
    expect(entries[0].kindLabel).toBe("character");
  });

  it("test_289_ac2_person_falls_back_to_a_short_account_id_or_deleted_account", () => {
    const [noEmail, deleted] = publishHistoryEntries([
      history({ id: 2, acted_by_email: null }),
      history({ id: 1, acted_by: null, acted_by_email: null }),
    ]);
    expect(noEmail.person).toBe("Account 0f3a9c21");
    expect(deleted.person).toBe("Deleted account");
  });

  it("test_289_ac2_time_is_shown_in_utc", () => {
    expect(formatHistoryTime("2026-01-03T23:59:00Z")).toBe("3 Jan 2026, 23:59 UTC");
    expect(formatHistoryTime("not a time")).toBe("not a time");
  });

  it("test_289_ac3_reads_through_the_editor_only_function_with_a_limit", async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const rows = [history({ id: 7 })];
    const read = await readPublishHistory(async (name, args) => {
      calls.push({ name, args });
      return { data: rows, error: null };
    });
    expect(calls).toEqual([
      { name: "list_publish_history", args: { row_limit: PUBLISH_HISTORY_LIMIT } },
    ]);
    expect(PUBLISH_HISTORY_LIMIT).toBe(100);
    expect(read).toEqual({ ok: true, rows });

    // An account without a role: the database refuses (42501), the page shows no rows.
    const refused = await readPublishHistory(async () => ({
      data: null,
      error: { code: "42501", message: "only a content editor may read the publish history" },
    }));
    expect(refused).toEqual({ ok: false, rows: [] });
  });

  it("test_289_ac2_roll_back_uses_the_roll_back_path_of_the_row_kind", async () => {
    const calls: unknown[] = [];
    const handlers = {
      app_text: async (key: string, version: number) => {
        calls.push([key, version]);
        return { ok: true } as const;
      },
      story_card: async () => ({ ok: false, error: "failed" }) as const,
      companion_field: async () => ({ ok: false, error: "failed" }) as const,
      story_field: async () => ({ ok: false, error: "failed" }) as const,
    };
    expect(
      await rollBackHistoryItem({ kind: "app_text", key: "ui.S1.back", version: 2 }, handlers),
    ).toEqual({ ok: true });
    expect(calls).toEqual([["ui.S1.back", 2]]);
    expect(
      await rollBackHistoryItem({ kind: "character", key: "x", version: 2 }, handlers),
    ).toEqual({ ok: false, error: "invalid" });
    expect(calls).toHaveLength(1);
  });

  it("test_289_ac2_the_page_action_checks_the_role_and_reuses_the_app_text_roll_back", () => {
    const actions = read("src/app/admin/publish-history/actions.ts");
    expect(actions.startsWith('"use server";')).toBe(true);
    expect(actions).toContain("rollBackHistoryItem(");
    expect(actions).toContain("rollBackAppTextAction");
    expect(actions).not.toMatch(/service_role|SERVICE_ROLE/);
    const page = read("src/app/admin/publish-history/page.tsx");
    expect(page).toContain("readPublishHistory(");
    // The placeholder text is gone.
    expect(page).not.toContain("once issue #289");
  });
});

describe("ADM-12 story card rows (#304)", () => {
  const card = (overrides: Partial<PublishHistoryRow>) =>
    history({ kind: "story_card", item_key: "crd.opp.site-search.p1.c1", ...overrides });

  it("test_304_ac7_story_card_rows_are_labelled_and_offer_roll_back_to_an_admin", () => {
    const entries = publishHistoryEntries(
      [card({ id: 2 }), card({ id: 1, is_current: true })],
      "admin",
    );
    expect(entries.map((entry) => [entry.kindLabel, entry.canRollBack])).toEqual([
      ["Story card", true],
      ["Story card", false],
    ]);
  });

  it("test_304_ac5_a_writer_sees_no_roll_back_on_story_card_rows", () => {
    const entries = publishHistoryEntries([card({ id: 2 }), history({ id: 1 })], "writer");
    expect(entries.map((entry) => [entry.kind, entry.canRollBack])).toEqual([
      ["story_card", false],
      ["app_text", true],
    ]);
  });

  it("test_304_ac7_roll_back_of_a_story_card_row_uses_the_story_card_path", async () => {
    const calls: unknown[] = [];
    const handlers = {
      app_text: async () => ({ ok: true }) as const,
      story_card: async (key: string, n: number) => {
        calls.push([key, n]);
        return { ok: true } as const;
      },
      companion_field: async () => ({ ok: false, error: "failed" }) as const,
      story_field: async () => ({ ok: false, error: "failed" }) as const,
    };
    expect(
      await rollBackHistoryItem(
        { kind: "story_card", key: "crd.opp.a.p1.c1", version: 1 },
        handlers,
      ),
    ).toEqual({ ok: true });
    expect(calls).toEqual([["crd.opp.a.p1.c1", 1]]);
    const actions = read("src/app/admin/publish-history/actions.ts");
    expect(actions).toContain("rollBackStoryCardAction");
  });
});

const version = (
  n: number,
  published: boolean,
  publishedAt: string | null,
  body = `Text ${n}`,
): AppTextVersionRow => ({
  key: "ui.S1.back",
  version: n,
  body,
  published,
  published_at: publishedAt,
  created_at: `2026-11-15T0${n}:00:00Z`,
});

describe("App text after a roll back (#289, known issue from #288)", () => {
  it("test_289_a_version_published_before_is_an_earlier_version_not_a_draft", () => {
    // v1 published, v2 published, then rolled back to v1: v2 was published before.
    const [row] = appTextAdminRows([
      version(1, true, "2026-11-15T11:00:00Z"),
      version(2, false, "2026-11-15T10:00:00Z"),
    ]).filter((entry) => entry.key === "ui.S1.back");
    expect(row.draft).toBeNull();
    expect(row.versions.map((v) => [v.version, v.state, v.canRollBack])).toEqual([
      [2, "earlier", true],
      [1, "published", false],
    ]);
  });

  it("test_289_the_newer_draft_is_the_newest_never_published_version", () => {
    const [row] = appTextAdminRows([
      version(1, true, "2026-11-15T11:00:00Z"),
      version(2, false, "2026-11-15T10:00:00Z"),
      version(3, false, null, "A new draft"),
    ]).filter((entry) => entry.key === "ui.S1.back");
    expect(row.draft).toEqual({ version: 3, body: "A new draft" });
    expect(row.versions.map((v) => [v.version, v.state])).toEqual([
      [3, "draft"],
      [2, "earlier"],
      [1, "published"],
    ]);
  });

  it("test_289_the_editor_labels_an_earlier_version_in_words", () => {
    const editor = read("src/app/admin/app-text/app-text-editor.tsx");
    expect(editor).toContain('earlier: "Earlier version"');
  });
});

describe("ADM-12 Companion and story field rows (#309)", () => {
  const field = (kind: string, overrides: Partial<PublishHistoryRow> = {}) =>
    history({
      kind,
      item_key: kind === "story_field" ? "opp.trinity.title" : "chr.opp.name",
      ...overrides,
    });

  it("test_309_ac5_field_rows_are_labelled_and_offer_roll_back_to_an_admin_only", () => {
    const rows = [field("companion_field", { id: 2 }), field("story_field", { id: 1 })];
    expect(
      publishHistoryEntries(rows, "admin").map((entry) => [entry.kindLabel, entry.canRollBack]),
    ).toEqual([
      ["Companion field", true],
      ["Story field", true],
    ]);
    expect(publishHistoryEntries(rows, "writer").map((entry) => entry.canRollBack)).toEqual([
      false,
      false,
    ]);
  });

  it("test_309_ac5_roll_back_of_a_field_row_uses_the_field_path", async () => {
    const calls: unknown[] = [];
    const handlers = {
      app_text: async () => ({ ok: false, error: "failed" }) as const,
      story_card: async () => ({ ok: false, error: "failed" }) as const,
      companion_field: async (key: string, n: number) => {
        calls.push(["companion", key, n]);
        return { ok: true } as const;
      },
      story_field: async (key: string, n: number) => {
        calls.push(["story", key, n]);
        return { ok: true } as const;
      },
    };
    await rollBackHistoryItem(
      { kind: "companion_field", key: "chr.opp.name", version: 1 },
      handlers,
    );
    await rollBackHistoryItem(
      { kind: "story_field", key: "opp.trinity.title", version: 3 },
      handlers,
    );
    expect(calls).toEqual([
      ["companion", "chr.opp.name", 1],
      ["story", "opp.trinity.title", 3],
    ]);
    const actions = read("src/app/admin/publish-history/actions.ts");
    expect(actions).toContain("rollBackContentFieldAction");
  });
});
