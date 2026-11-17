import { describe, expect, it } from "vitest";
import {
  PROMPT_BODY_MAX_LENGTH,
  PROMPT_NOTE_MAX_LENGTH,
  writePrompt,
  type PromptVersionRow,
  type PromptWrite,
} from "@/lib/prompts/admin";
import type { ContentRole } from "@/lib/admin/roles";
import { seedRows } from "./support/seed-prompts";

// #308 AC3, AC5, AC7: the writes behind ADM-08's buttons, refused before any database call when
// the account, the role, the input or the gateway's row check says no.

const seed = seedRows().find((row) => row.key === "rest_reply")!;
const settings = JSON.stringify(seed.params);
const rows = (): PromptVersionRow[] => [
  {
    key: "rest_reply",
    version: 1,
    active: true,
    body: seed.body,
    params: structuredClone(seed.params),
    note: "seed",
    created_at: "2026-11-14T00:00:00Z",
    activated_at: "2026-11-14T00:00:00Z",
  },
  {
    key: "rest_reply",
    version: 2,
    active: false,
    body: seed.body.replace("{{facts}}", "{{fatcs}}"),
    params: structuredClone(seed.params),
    note: "",
    created_at: "2026-11-15T00:00:00Z",
    activated_at: null,
  },
  {
    key: "rest_reply",
    version: 3,
    active: false,
    body: `${seed.body}\nKeep it short.`,
    params: structuredClone(seed.params),
    note: "",
    created_at: "2026-11-16T00:00:00Z",
    activated_at: null,
  },
];

function deps(role: ContentRole | null = "admin", data: unknown = 4) {
  const calls: [string, Record<string, unknown>][] = [];
  return {
    calls,
    deps: {
      userId: role ? "u1" : null,
      role,
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push([name, args]);
        return { data, error: null };
      },
      readVersions: async () => rows(),
    },
  };
}

const save = (overrides: Partial<Extract<PromptWrite, { kind: "save" }>>): PromptWrite => ({
  kind: "save",
  key: "rest_reply",
  body: `${seed.body}\nNew line.`,
  settings,
  note: "",
  ...overrides,
});

describe("ADM-08 save (#308 AC3)", () => {
  it("test_308_ac3_save_refuses_blank_too_long_bad_json_non_object_and_unchanged", async () => {
    const cases: [PromptWrite, string][] = [
      [save({ body: "  " }), "blank"],
      [save({ body: "x".repeat(PROMPT_BODY_MAX_LENGTH + 1) }), "too-long"],
      [save({ note: "x".repeat(PROMPT_NOTE_MAX_LENGTH + 1) }), "note-too-long"],
      [save({ settings: "{" }), "settings-json"],
      [save({ settings: "[]" }), "settings-json"],
      [save({ settings: "null" }), "settings-json"],
      [save({ settings: "3" }), "settings-json"],
      [save({ settings: '"x"' }), "settings-json"],
      // The same as the newest version (v3), with the settings keys in another order.
      [
        save({
          body: `${seed.body}\nKeep it short.`,
          settings: JSON.stringify({
            checks: { min_sentences: 1, max_words: 80, max_sentences: 3 },
          }),
        }),
        "unchanged",
      ],
      [save({ key: "nope" }), "invalid"],
    ];
    for (const [write, error] of cases) {
      const { calls, deps: d } = deps("writer");
      expect(await writePrompt(write, d), error).toMatchObject({ ok: false, error });
      expect(calls, error).toEqual([]);
    }
  });

  it("test_308_ac3_save_calls_save_prompt_draft_and_returns_version", async () => {
    const { calls, deps: d } = deps("writer", 4);
    expect(await writePrompt(save({ note: "shorter" }), d)).toEqual({ ok: true, version: 4 });
    expect(calls).toEqual([
      [
        "save_prompt_draft",
        {
          prompt_key: "rest_reply",
          prompt_body: `${seed.body}\nNew line.`,
          prompt_params: seed.params,
          prompt_note: "shorter",
        },
      ],
    ]);
  });

  it("test_308_ac3_save_without_an_account_or_role_is_not_allowed", async () => {
    const { calls, deps: d } = deps(null);
    expect(await writePrompt(save({}), d)).toEqual({ ok: false, error: "not-allowed" });
    expect(calls).toEqual([]);
  });

  it("test_308_ac3_a_database_error_is_failed", async () => {
    const d = { ...deps("writer").deps, rpc: async () => ({ data: null, error: { code: "x" } }) };
    expect(await writePrompt(save({}), d)).toEqual({ ok: false, error: "failed" });
  });
});

describe("ADM-08 publish and roll back (#308 AC5, AC7)", () => {
  it("test_308_ac5_writer_cannot_publish_or_roll_back", async () => {
    for (const kind of ["publish", "roll_back"] as const) {
      const { calls, deps: d } = deps("writer");
      expect(await writePrompt({ kind, key: "rest_reply", version: 3 }, d)).toEqual({
        ok: false,
        error: "not-allowed",
      });
      expect(calls).toEqual([]);
    }
  });

  it("test_308_ac7_publish_refuses_a_failing_version_with_problems", async () => {
    const { calls, deps: d } = deps("admin");
    expect(await writePrompt({ kind: "publish", key: "rest_reply", version: 2 }, d)).toEqual({
      ok: false,
      error: "checks-failed",
      problems: ["Unknown {{fatcs}} in the prompt."],
    });
    expect(calls).toEqual([]);
  });

  it("test_308_ac7_roll_back_refuses_a_failing_version", async () => {
    const { calls, deps: d } = deps("admin");
    expect(
      await writePrompt({ kind: "roll_back", key: "rest_reply", version: 2 }, d),
    ).toMatchObject({ ok: false, error: "checks-failed" });
    expect(calls).toEqual([]);
  });

  it("test_308_ac5_admin_publishes_a_passing_draft_through_publish_prompt", async () => {
    const { calls, deps: d } = deps("admin", null);
    expect(await writePrompt({ kind: "publish", key: "rest_reply", version: 3 }, d)).toEqual({
      ok: true,
    });
    expect(calls).toEqual([["publish_prompt", { prompt_key: "rest_reply", prompt_version: 3 }]]);
  });

  it("test_308_ac6_admin_rolls_back_through_roll_back_prompt", async () => {
    const { calls, deps: d } = deps("admin", null);
    expect(await writePrompt({ kind: "roll_back", key: "rest_reply", version: 1 }, d)).toEqual({
      ok: true,
    });
    expect(calls).toEqual([["roll_back_prompt", { prompt_key: "rest_reply", prompt_version: 1 }]]);
  });

  it("test_308_unknown_key_or_version_is_invalid", async () => {
    for (const write of [
      { kind: "publish", key: "nope", version: 1 },
      { kind: "publish", key: "rest_reply", version: 0 },
      { kind: "publish", key: "rest_reply", version: 9 },
    ] as PromptWrite[]) {
      const { calls, deps: d } = deps("admin");
      expect(await writePrompt(write, d)).toEqual({ ok: false, error: "invalid" });
      expect(calls).toEqual([]);
    }
    const unread = { ...deps("admin").deps, readVersions: async () => null };
    expect(await writePrompt({ kind: "publish", key: "rest_reply", version: 3 }, unread)).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("ADM-08 save with the page's start values (#308 review)", () => {
  it("test_308_ac3_save_with_no_edits_and_an_empty_note_is_unchanged", async () => {
    const calls: unknown[] = [];
    const only = rows().slice(0, 1); // v1 active, note "seed"
    const result = await writePrompt(
      { kind: "save", key: "rest_reply", body: seed.body, settings, note: "" },
      {
        userId: "u1",
        role: "writer",
        rpc: async (name, args) => {
          calls.push([name, args]);
          return { data: 2, error: null };
        },
        readVersions: async () => only,
      },
    );
    expect(result).toEqual({ ok: false, error: "unchanged" });
    expect(calls).toEqual([]);
  });
});
