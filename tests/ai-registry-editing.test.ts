import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import {
  changeFeatureCategory,
  confirmFeatureExample,
  exampleChanges,
  fieldChanges,
  historyValue,
  registryEditorValues,
  saveRegistryFields,
  setFeatureExample,
  titleKeys,
} from "@/lib/ai-features/registry-edit";

// #475 (registry slice 3; docs/PRD.md FR-AIREG-7, AI-PAGE-EDIT, AI-EXAMPLE-CONFIRM): editing a
// registry row. The server logic with a fake database, and the database's own rules read from the
// migrations (the role checks were also run on PGlite, see the PR). The pages are tested in
// e2e/ai-registry-editing.spec.ts. All text here is invented for the test.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
/** A migration without its comments, so a comment cannot satisfy a check. */
const sql = (file: string) =>
  readFileSync(path.join(migrations, file), "utf8").replace(/--.*$/gm, "");
const EDITING = "20261204000000_ai_registry_editing.sql";
const REGISTRY = "20261202000000_ai_registry.sql";
const fn = (file: string, name: string) => {
  const code = sql(file);
  const match = code.match(
    new RegExp(`create (?:or replace )?function ${name.replace(".", "\\.")}\\(`),
  );
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code.slice(start, code.indexOf("$$;", code.indexOf("$$", start) + 2) + 3);
};

const feature = (over: Partial<RegistryFeature> = {}): RegistryFeature => ({
  slug: "p01_find_episodes",
  position: 8,
  title: "Find episodes (p01_find_episodes)",
  prompt_keys: ["p01_find_episodes"],
  purpose: [],
  pass_questions: [],
  approach: [],
  status: "exploring",
  feature_id: "P-01",
  category: "pipeline",
  where_used: "Invented place",
  requirement: "Invented requirement.",
  output_format: "",
  design_rationale: "",
  room_to_improve: "",
  notes: "",
  example_text: "Invented example.",
  example_state: "candidate",
  example_set_by: null,
  example_set_at: null,
  fields_updated_at: null,
  fields_updated_by: null,
  ...over,
});

type Call = { name: string; args: Record<string, unknown> };

function fakeDb(
  role: "admin" | "writer" | null,
  row: RegistryFeature | null | undefined = feature(),
  answer: { data?: unknown; error?: unknown } = {},
) {
  const calls: Call[] = [];
  return {
    calls,
    deps: {
      userId: role === null ? null : "00000000-0000-4000-8000-000000000001",
      role,
      readFeature: async () => row,
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: answer.data ?? null, error: answer.error ?? null };
      },
    },
  };
}

const write = (over: Record<string, unknown> = {}) => ({
  slug: "p01_find_episodes",
  loadedAt: null,
  name: "Find episodes again",
  where_used: "Invented place",
  requirement: "Invented requirement, edited.",
  output_format: "Invented format.",
  design_rationale: "",
  room_to_improve: "",
  notes: "Invented note.",
  ...over,
});

describe("#475 AC1: an admin or a writer edits every field but status and category", () => {
  for (const role of ["admin", "writer"] as const) {
    it(`test_475_ac1_a_${role}_saves_the_name_and_the_six_fields_in_one_call`, async () => {
      const db = fakeDb(role, feature(), { data: "2026-11-26T10:00:00Z" });
      expect(await saveRegistryFields(write(), db.deps)).toEqual({
        ok: true,
        savedAt: "2026-11-26T10:00:00Z",
      });
      expect(db.calls).toEqual([
        {
          name: "save_ai_feature_registry_fields",
          args: {
            target_feature: "p01_find_episodes",
            loaded_at: null,
            new_name: "Find episodes again",
            new_where_used: "Invented place",
            new_requirement: "Invented requirement, edited.",
            new_output_format: "Invented format.",
            new_design_rationale: "",
            new_room_to_improve: "",
            new_notes: "Invented note.",
          },
        },
      ]);
    });
  }

  it("test_475_ac1_the_save_never_sends_a_status_a_category_or_an_example", async () => {
    const db = fakeDb("writer");
    await saveRegistryFields(
      write({ status: "passed", category: "gate", example_state: "confirmed" }),
      db.deps,
    );
    const keys = Object.keys(db.calls[0].args);
    expect(keys.some((key) => /status|category|example/.test(key))).toBe(false);
  });

  it("test_475_ac1_no_role_or_no_session_is_refused_before_any_call", async () => {
    for (const db of [fakeDb(null)]) {
      expect(await saveRegistryFields(write(), db.deps)).toEqual({
        ok: false,
        error: "not-allowed",
      });
      expect(db.calls).toEqual([]);
    }
  });

  it("test_475_ac1_a_name_is_needed_has_no_brackets_and_fits_the_title", async () => {
    const db = fakeDb("writer");
    expect(await saveRegistryFields(write({ name: "  " }), db.deps)).toMatchObject({
      error: "name-empty",
    });
    expect(await saveRegistryFields(write({ name: "Find (x)" }), db.deps)).toMatchObject({
      error: "name-brackets",
    });
    expect(await saveRegistryFields(write({ name: "n".repeat(110) }), db.deps)).toMatchObject({
      error: "name-too-long",
    });
    expect(await saveRegistryFields(write({ where_used: "w".repeat(301) }), db.deps)).toMatchObject(
      { error: "field-too-long" },
    );
    expect(db.calls).toEqual([]);
  });

  it("test_475_ac1_a_newer_save_by_someone_else_is_not_overwritten", async () => {
    const db = fakeDb("writer", feature({ fields_updated_at: "2026-11-26T09:00:00Z" }));
    expect(await saveRegistryFields(write({ loadedAt: null }), db.deps)).toEqual({
      ok: false,
      error: "changed-since",
    });
    expect(db.calls).toEqual([]);
    // The database checks it again inside its transaction (40001).
    const raced = fakeDb("writer", feature(), { error: { code: "40001" } });
    expect(await saveRegistryFields(write(), raced.deps)).toEqual({
      ok: false,
      error: "changed-since",
    });
  });

  it("test_475_ac1_the_editor_shows_the_name_without_its_prompt_keys", () => {
    expect(titleKeys("Pause message (stuck_story + pause_predicament)")).toBe(
      " (stuck_story + pause_predicament)",
    );
    expect(titleKeys("No keys")).toBe("");
    expect(registryEditorValues(feature())).toMatchObject({
      name: "Find episodes",
      where_used: "Invented place",
      notes: "",
    });
  });
});

describe("#475 AC1: every change is kept with who and when (the database)", () => {
  it("test_475_ac1_the_save_function_is_for_content_editors_and_checks_the_load_time", () => {
    const body = fn(EDITING, "public.save_ai_feature_registry_fields");
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/if not public\.is_content_editor\(\) then\s+raise exception[^;]*'42501'/);
    expect(body).toMatch(/for update/);
    expect(body).toMatch(/old\.fields_updated_at is distinct from loaded_at[\s\S]*?'40001'/);
    // The name keeps the title's bracketed prompt keys, and its change is a history row.
    expect(body).toMatch(/substring\(old\.title from/);
    expect(body).toMatch(/record_ai_feature_field\(target_feature, 'title'/);
    // The six fields and their history rows: the function of 20261202000000.
    expect(body).toMatch(/perform public\.save_ai_feature_fields\(/);
    expect(body).not.toMatch(/category|status|example/);
    expect(sql(EDITING)).toMatch(
      /grant execute on function public\.save_ai_feature_registry_fields\([^)]*\) to authenticated/,
    );
    expect(sql(EDITING)).toMatch(
      /revoke all on function public\.save_ai_feature_registry_fields\([^)]*\)\s+from public, anon, authenticated/,
    );
  });

  it("test_475_ac1_the_history_accepts_the_name_and_records_who_and_when", () => {
    expect(sql(EDITING)).toMatch(
      /add constraint ai_feature_field_history_field_names check \(\s+field in \(\s+'title', 'category'/,
    );
    const record = fn(REGISTRY, "private.record_ai_feature_field");
    expect(record).toMatch(/changed_by\)\s+values \([^)]*auth\.uid\(\)\)/);
    expect(sql(REGISTRY)).toMatch(/changed_at timestamptz not null default now\(\)/);
  });

  it("test_475_ac1_who_made_a_change_is_shown_by_email", () => {
    const people = fn(EDITING, "public.list_ai_feature_people");
    expect(people).toMatch(/if not public\.is_content_editor\(\)/);
    for (const source of [
      "public.ai_feature_status_history",
      "public.ai_feature_field_history",
      "public.ai_feature_example_history",
      "f.sections_updated_by",
      "f.fields_updated_by",
      "f.example_set_by",
    ]) {
      expect(people, source).toContain(source);
    }
  });

  it("test_475_runs_after_the_registry_and_run_log_migrations", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.at(-1)).toBe(EDITING);
    expect(names.indexOf(EDITING)).toBeGreaterThan(names.indexOf(REGISTRY));
  });
});

describe("#475 AC2: status and category are admin only, on the server and in the database", () => {
  it("test_475_ac2_a_writer_cannot_change_the_category_and_nothing_is_called", async () => {
    const db = fakeDb("writer");
    expect(
      await changeFeatureCategory({ slug: "p01_find_episodes", category: "gate" }, db.deps),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(db.calls).toEqual([]);
  });

  it("test_475_ac2_an_admin_changes_the_category", async () => {
    const db = fakeDb("admin");
    expect(
      await changeFeatureCategory({ slug: "p01_find_episodes", category: "gate" }, db.deps),
    ).toEqual({ ok: true });
    expect(db.calls).toEqual([
      {
        name: "set_ai_feature_category",
        args: { target_feature: "p01_find_episodes", new_category: "gate" },
      },
    ]);
    const same = fakeDb("admin");
    expect(
      await changeFeatureCategory({ slug: "p01_find_episodes", category: "pipeline" }, same.deps),
    ).toEqual({ ok: false, error: "category-unchanged" });
    expect(
      await changeFeatureCategory({ slug: "p01_find_episodes", category: "other" }, same.deps),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("test_475_ac2_a_database_refusal_is_reported_as_not_allowed", async () => {
    const db = fakeDb("admin", feature(), { error: { code: "42501" } });
    expect(
      await changeFeatureCategory({ slug: "p01_find_episodes", category: "gate" }, db.deps),
    ).toEqual({ ok: false, error: "not-allowed" });
  });

  it("test_475_ac2_the_database_refuses_a_writer_status_and_category", () => {
    for (const [name, file] of [
      ["public.set_ai_feature_category", REGISTRY],
      ["public.set_ai_feature_status", "20261130000000_ai_features.sql"],
    ] as const) {
      const body = fn(file, name);
      expect(body, name).toMatch(/security definer/);
      expect(body, name).toMatch(
        /if public\.content_role\(\) is distinct from 'admin' then\s+raise exception[^;]*'42501'/,
      );
    }
    // No API role writes the table directly, so the only way to a category is that function.
    expect(sql("20261130000000_ai_features.sql")).toMatch(
      /revoke all on public\.ai_features from public, anon, authenticated;\s+grant select on public\.ai_features to authenticated;/,
    );
    // The fields' save never touches the category or the status.
    const fields = fn(REGISTRY, "public.save_ai_feature_fields");
    expect(fields.slice(fields.indexOf("update public.ai_features"))).not.toMatch(
      /category =|status =/,
    );
  });
});

describe("#475 AC3: any role sets an example candidate or confirmed", () => {
  for (const role of ["admin", "writer"] as const) {
    for (const state of ["candidate", "confirmed"] as const) {
      it(`test_475_ac3_a_${role}_sets_an_example_${state}`, async () => {
        const db = fakeDb(role, feature({ example_text: "", example_state: "none" }));
        expect(
          await setFeatureExample(
            { slug: "p01_find_episodes", loadedAt: null, text: "Invented output.", state },
            db.deps,
          ),
        ).toEqual({ ok: true });
        expect(db.calls).toEqual([
          {
            name: "set_ai_feature_example",
            args: {
              target_feature: "p01_find_episodes",
              new_text: "Invented output.",
              new_state: state,
            },
          },
        ]);
      });
    }
  }

  it("test_475_ac3_a_candidate_becomes_confirmed_with_one_action", async () => {
    const db = fakeDb("writer", feature({ example_set_at: "2026-11-26T08:00:00Z" }));
    expect(
      await confirmFeatureExample(
        { slug: "p01_find_episodes", loadedAt: "2026-11-26T08:00:00Z" },
        db.deps,
      ),
    ).toEqual({ ok: true });
    expect(db.calls).toEqual([
      {
        name: "set_ai_feature_example",
        args: {
          target_feature: "p01_find_episodes",
          new_text: "Invented example.",
          new_state: "confirmed",
        },
      },
    ]);
  });

  it("test_475_ac3_confirm_refuses_a_changed_or_not_candidate_example", async () => {
    const changed = fakeDb("admin", feature({ example_set_at: "2026-11-26T09:00:00Z" }));
    expect(
      await confirmFeatureExample({ slug: "p01_find_episodes", loadedAt: null }, changed.deps),
    ).toEqual({ ok: false, error: "changed-since" });
    const confirmed = fakeDb("admin", feature({ example_state: "confirmed" }));
    expect(
      await confirmFeatureExample({ slug: "p01_find_episodes", loadedAt: null }, confirmed.deps),
    ).toEqual({ ok: false, error: "invalid" });
    expect([...changed.calls, ...confirmed.calls]).toEqual([]);
  });

  it("test_475_ac3_a_candidate_or_confirmed_example_needs_text_and_no_role_is_refused", async () => {
    const db = fakeDb("writer");
    expect(
      await setFeatureExample(
        { slug: "p01_find_episodes", loadedAt: null, text: " ", state: "confirmed" },
        db.deps,
      ),
    ).toEqual({ ok: false, error: "example-needs-text" });
    expect(
      await setFeatureExample(
        { slug: "p01_find_episodes", loadedAt: null, text: "x", state: "approved" },
        db.deps,
      ),
    ).toEqual({ ok: false, error: "invalid" });
    const nobody = fakeDb(null);
    expect(
      await setFeatureExample(
        { slug: "p01_find_episodes", loadedAt: null, text: "x", state: "candidate" },
        nobody.deps,
      ),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect([...db.calls, ...nobody.calls]).toEqual([]);
  });

  it("test_475_ac3_the_database_keeps_every_example_with_who_and_when", () => {
    const body = fn(REGISTRY, "public.set_ai_feature_example");
    expect(body).toMatch(/if not public\.is_content_editor\(\)/);
    expect(body).toMatch(/example_set_by = auth\.uid\(\),\s+example_set_at = now\(\)/);
    expect(body).toMatch(
      /insert into public\.ai_feature_example_history \(feature_slug, example_text, example_state, set_by\)/,
    );
  });

  it("test_475_ac3_a_replaced_confirmed_example_stays_in_the_history_newest_first", () => {
    const people = new Map([["u1", "writer@example.invalid"]]);
    const changes = exampleChanges(
      [
        {
          id: 1,
          feature_slug: "x",
          example_text: "Old confirmed.",
          example_state: "confirmed",
          set_by: null,
          set_at: "2026-11-20T10:00:00Z",
        },
        {
          id: 2,
          feature_slug: "x",
          example_text: "New confirmed.",
          example_state: "confirmed",
          set_by: "u1",
          set_at: "2026-11-26T10:00:00Z",
        },
      ],
      people,
    );
    expect(changes.map((change) => [change.person, change.state, change.text])).toEqual([
      ["writer@example.invalid", "confirmed", "New confirmed."],
      ["Setup", "confirmed", "Old confirmed."],
    ]);
  });
});

describe("#475 the editors show their history: who, when, old and new", () => {
  it("test_475_field_changes_show_who_when_old_and_new", () => {
    const people = new Map([["u1", "admin@example.invalid"]]);
    const changes = fieldChanges(
      [
        {
          id: 1,
          feature_slug: "x",
          field: "requirement",
          old_value: "",
          new_value: "Invented requirement.",
          changed_by: "u1",
          changed_at: "2026-11-25T10:00:00Z",
        },
        {
          id: 2,
          feature_slug: "x",
          field: "category",
          old_value: "pipeline",
          new_value: "gate",
          changed_by: "u1",
          changed_at: "2026-11-26T10:00:00Z",
        },
        {
          id: 3,
          feature_slug: "x",
          field: "title",
          old_value: "Find episodes (p01_find_episodes)",
          new_value: "Find more (p01_find_episodes)",
          changed_by: null,
          changed_at: "2026-11-26T10:00:00Z",
        },
      ],
      people,
    );
    expect(changes.map((change) => [change.field, change.from, change.to, change.person])).toEqual([
      ["Name", "Find episodes", "Find more", "Deleted account"],
      ["Category", "Pipeline", "Quality gate", "admin@example.invalid"],
      ["Requirement", "", "Invented requirement.", "admin@example.invalid"],
    ]);
    expect(changes[1]).toMatchObject({
      time: "2026-11-26 10:00",
      dateTime: "2026-11-26T10:00:00Z",
    });
  });

  it("test_475_a_list_value_shows_one_line_per_item", () => {
    expect(
      historyValue("pass_questions", [
        { text: "First?", source: null, draft: false },
        { text: "Second?", source: "x.md:1", draft: true },
      ]),
    ).toBe("First?\nSecond?");
  });
});
