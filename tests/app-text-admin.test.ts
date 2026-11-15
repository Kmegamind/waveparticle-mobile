import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  appTextAdminRows,
  writeAppText,
  type AppTextVersionRow,
  type AppTextWrite,
} from "@/lib/app-text/admin";
import { APP_TEXT_DEFAULTS, APP_TEXT_KEYS } from "@/lib/app-text/catalog";
import { ADMIN_CACHE_CONTROL, withAdminCacheControl } from "@/lib/admin/roles";

// #288 AC1, AC2: the App text page (ADM-07), its server-side writes, and /admin never cached.

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

function writer(role: "writer" | "admin" | null = "writer", userId: string | null = "u1") {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let cleared = 0;
  return {
    calls,
    cleared: () => cleared,
    run: (write: AppTextWrite, error: unknown = null) =>
      writeAppText(write, {
        userId,
        role,
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: write.kind === "save" ? 4 : null, error };
        },
        clearCache: () => {
          cleared += 1;
        },
      }),
  };
}

describe("ADM-07 rows (#288)", () => {
  it("test_288_ac2_lists_every_key_with_screen_published_text_and_newer_draft", () => {
    const rows = appTextAdminRows([
      row(
        "ui.F3.fail.body",
        1,
        "He is not here right now. Please try again.",
        false,
        "2026-11-15T09:00:00Z",
      ),
      row("ui.F3.fail.body", 2, "Gone for now.", true),
      row("ui.F3.fail.body", 3, "Out for a walk."),
      row("ui.S1.back", 1, "Back to my Goal", true),
      row("ui.S1.gone", 1, "Not a key the app reads", true),
    ]);
    expect(rows.map((entry) => entry.key)).toEqual([...APP_TEXT_KEYS]);

    const f3 = rows.find((entry) => entry.key === "ui.F3.fail.body")!;
    expect(f3.screen).toBe("F3");
    expect(f3.defaultText).toBe(APP_TEXT_DEFAULTS["ui.F3.fail.body"]);
    expect(f3.published).toEqual({ version: 2, body: "Gone for now." });
    expect(f3.draft).toEqual({ version: 3, body: "Out for a walk." });
    expect(f3.versions.map((v) => [v.version, v.state])).toEqual([
      [3, "draft"],
      [2, "published"],
      [1, "earlier"],
    ]);

    const back = rows.find((entry) => entry.key === "ui.S1.back")!;
    expect(back.published).toEqual({ version: 1, body: "Back to my Goal" });
    expect(back.draft).toBeNull();

    // A key the database does not have yet: the app shows its default.
    const offline = rows.find((entry) => entry.key === "ui.R-OFF.body")!;
    expect(offline.published).toBeNull();
    expect(offline.versions).toEqual([]);
  });

  it("test_288_ac2_offers_roll_back_only_to_earlier_published_versions", () => {
    const rows = appTextAdminRows([
      row("ui.S1.back", 1, "Back to my Goal", false, "2026-11-15T09:00:00Z"),
      row("ui.S1.back", 2, "Never published"),
      row("ui.S1.back", 3, "Back", true),
      row("ui.S1.back", 4, "A newer draft"),
    ]);
    const back = rows.find((entry) => entry.key === "ui.S1.back")!;
    expect(back.versions.map((v) => [v.version, v.canRollBack])).toEqual([
      [4, false],
      [3, false],
      [2, false],
      [1, true],
    ]);
    expect(back.draft).toEqual({ version: 4, body: "A newer draft" });
  });
});

describe("app text writes (#288)", () => {
  it("test_288_ac1_actions_refuse_an_account_without_a_role", async () => {
    for (const [role, userId] of [
      [null, "u1"],
      ["writer", null],
    ] as const) {
      const w = writer(role, userId);
      expect(await w.run({ kind: "save", key: "ui.S1.back", body: "Back" })).toEqual({
        ok: false,
        error: "not-allowed",
      });
      expect(await w.run({ kind: "publish", key: "ui.S1.back", version: 2 })).toEqual({
        ok: false,
        error: "not-allowed",
      });
      expect(w.calls).toEqual([]);
    }
  });

  it("test_288_ac1_actions_refuse_a_blank_text_and_unknown_key", async () => {
    const w = writer();
    expect(await w.run({ kind: "save", key: "ui.S1.back", body: "  \n " })).toEqual({
      ok: false,
      error: "blank",
    });
    expect(await w.run({ kind: "save", key: "ui.S1.back", body: "x".repeat(1001) })).toEqual({
      ok: false,
      error: "too-long",
    });
    expect(await w.run({ kind: "save", key: "ui.S1.nothing", body: "Back" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await w.run({ kind: "roll_back", key: "ui.S1.back", version: 0 })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(w.calls).toEqual([]);
  });

  it("test_288_ac2_save_publish_and_roll_back_call_their_database_functions", async () => {
    const w = writer("admin");
    expect(await w.run({ kind: "save", key: "ui.S1.back", body: " Back " })).toEqual({
      ok: true,
      version: 4,
    });
    expect(await w.run({ kind: "publish", key: "ui.S1.back", version: 4 })).toEqual({ ok: true });
    expect(await w.run({ kind: "roll_back", key: "ui.S1.back", version: 1 })).toEqual({
      ok: true,
    });
    expect(w.calls).toEqual([
      { name: "save_app_text_draft", args: { text_key: "ui.S1.back", text_body: " Back " } },
      { name: "publish_app_text", args: { text_key: "ui.S1.back", text_version: 4 } },
      { name: "roll_back_app_text", args: { text_key: "ui.S1.back", text_version: 1 } },
    ]);
  });

  it("test_288_ac2_publish_clears_the_reader_cache", async () => {
    const w = writer();
    await w.run({ kind: "save", key: "ui.S1.back", body: "Back" });
    expect(w.cleared()).toBe(0);
    await w.run({ kind: "publish", key: "ui.S1.back", version: 4 });
    await w.run({ kind: "roll_back", key: "ui.S1.back", version: 1 });
    expect(w.cleared()).toBe(2);
    expect(
      await w.run({ kind: "publish", key: "ui.S1.back", version: 5 }, { message: "no" }),
    ).toEqual({
      ok: false,
      error: "failed",
    });
    expect(w.cleared()).toBe(2);
  });

  it("test_288_ac1_server_actions_check_the_role_on_the_server", () => {
    const source = read("src/app/admin/app-text/actions.ts");
    expect(source.startsWith('"use server";')).toBe(true);
    expect(source).toContain("readContentRole(client)");
    expect(source).toContain("getCurrentUser(client)");
    expect(source).toContain("writeAppText(");
    expect(source).not.toMatch(/service_role|SERVICE_ROLE/);
  });
});

describe("/admin is never cached (#288)", () => {
  it("test_288_admin_responses_are_never_cached", () => {
    expect(ADMIN_CACHE_CONTROL).toBe("private, no-store, max-age=0");
    const response = withAdminCacheControl(NextResponse.next());
    expect(response.headers.get("cache-control")).toBe(ADMIN_CACHE_CONTROL);
    const session = read("src/lib/supabase/session.ts");
    expect(session.match(/withAdminCacheControl\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
