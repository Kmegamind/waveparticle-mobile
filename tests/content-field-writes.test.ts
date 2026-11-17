import { describe, expect, it } from "vitest";
import { fieldProblems, type FieldKey } from "@/lib/content-fields/fields";
import { fieldView, type ContentFieldRow } from "@/lib/content-fields/view";
import { writeContentField } from "@/lib/content-fields/write";

// #309: the writes behind Save draft, Publish and Roll back of a Companion or story field.

const stories = [
  { id: "s1", sequence: 1, period: "Youth" },
  { id: "s2", sequence: 2, period: "Berkeley" },
];

function deps(role: "admin" | "writer" | null, stored: Record<number, string> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    deps: {
      userId: role ? "user-1" : null,
      role,
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: name === "save_content_field_draft" ? 3 : null, error: null };
      },
      problemsOf: async (key: FieldKey, body: string) => fieldProblems(key, body, { stories }),
      storedBody: async (_key: string, version: number) => stored[version] ?? null,
    },
  };
}

describe("content field writes (#309)", () => {
  it("test_309_ac1_a_writer_saves_a_draft", async () => {
    const { calls, deps: d } = deps("writer");
    const result = await writeContentField({ kind: "save", key: "opp.s1.title", body: "A" }, d);
    expect(result).toEqual({ ok: true, version: 3 });
    expect(calls).toEqual([
      { name: "save_content_field_draft", args: { field_key: "opp.s1.title", field_body: "A" } },
    ]);
  });

  it("test_309_ac2_a_dated_text_is_refused_before_any_database_call", async () => {
    const { calls, deps: d } = deps("admin");
    const result = await writeContentField(
      { kind: "save", key: "opp.s1.goal", body: "Finish it by 1943." },
      d,
    );
    expect(result).toEqual({
      ok: false,
      error: "checks-failed",
      problems: ['Mentions a year ("1943"). Years and dates stay in the admin.'],
    });
    expect(calls).toEqual([]);
  });

  it("test_309_ac3_a_writer_cannot_publish_or_roll_back", async () => {
    for (const kind of ["publish", "roll_back"] as const) {
      const { calls, deps: d } = deps("writer", { 2: "A" });
      const result = await writeContentField({ kind, key: "opp.s1.title", version: 2 }, d);
      expect(result).toEqual({ ok: false, error: "not-allowed" });
      expect(calls).toEqual([]);
    }
  });

  it("test_309_ac3_no_account_or_an_unknown_key_writes_nothing", async () => {
    const none = deps(null);
    expect(
      await writeContentField({ kind: "save", key: "opp.s1.title", body: "A" }, none.deps),
    ).toEqual({ ok: false, error: "not-allowed" });
    const admin = deps("admin");
    expect(
      await writeContentField({ kind: "save", key: "opp.s1.facts", body: "A" }, admin.deps),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await writeContentField({ kind: "publish", key: "opp.s1.title", version: 0 }, admin.deps),
    ).toEqual({ ok: false, error: "invalid" });
    expect([...none.calls, ...admin.calls]).toEqual([]);
  });

  it("test_309_ac4_publish_re_checks_the_stored_version", async () => {
    const failing = deps("admin", { 2: "Born in 1904" });
    expect(
      await writeContentField({ kind: "publish", key: "opp.s1.title", version: 2 }, failing.deps),
    ).toEqual({
      ok: false,
      error: "checks-failed",
      problems: ['Mentions a year ("1904"). Years and dates stay in the admin.'],
    });
    expect(failing.calls).toEqual([]);
    const passing = deps("admin", { 2: "Berkeley" });
    expect(
      await writeContentField(
        { kind: "roll_back", key: "opp.s2.period", version: 2 },
        passing.deps,
      ),
    ).toEqual({ ok: true });
    expect(passing.calls).toEqual([
      { name: "roll_back_content_field", args: { field_key: "opp.s2.period", field_version: 2 } },
    ]);
  });

  it("test_309_a_missing_stored_version_is_refused", async () => {
    const { calls, deps: d } = deps("admin");
    expect(
      await writeContentField({ kind: "publish", key: "chr.opp.name", version: 5 }, d),
    ).toEqual({ ok: false, error: "invalid" });
    expect(calls).toEqual([]);
  });
});

const row = (version: number, body: string, published = false, publishedAt: string | null = null) =>
  ({ key: "opp.s1.title", version, body, published, published_at: publishedAt }) as ContentFieldRow;

describe("content field view (#309)", () => {
  it("test_309_a_field_with_no_versions_shows_the_text_the_app_shows", () => {
    expect(fieldView("opp.s1.title", "Shown now", [])).toEqual({
      key: "opp.s1.title",
      shown: "Shown now",
      draft: null,
      versions: [],
    });
  });

  it("test_309_versions_are_published_draft_or_earlier_and_earlier_ones_roll_back", () => {
    const view = fieldView("opp.s1.title", "B", [
      row(1, "A", false, "2026-11-16T00:00:00Z"),
      row(2, "B", true, "2026-11-17T00:00:00Z"),
      row(3, "C"),
    ]);
    expect(view.draft).toEqual({ version: 3, body: "C" });
    expect(view.versions).toEqual([
      { version: 3, body: "C", state: "draft", canRollBack: false },
      { version: 2, body: "B", state: "published", canRollBack: false },
      { version: 1, body: "A", state: "earlier", canRollBack: true },
    ]);
  });
});
