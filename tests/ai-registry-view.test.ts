import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABEL,
  compareFeatureIds,
  exampleSetBy,
  filterRegistry,
  isFeatureId,
  NO_FILTER,
  promptPanels,
  promptParts,
  registryRow,
  versionHistory,
  type RegistryFeature,
  type RegistryRow,
} from "@/lib/ai-features/registry";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import { changeFeatureStatus, editable, saveFeatureSections } from "@/lib/ai-features/edit";

// #474 (registry slice 2; docs/PRD.md FR-AIREG-1 to FR-AIREG-4): the registry table and the
// feature detail, read only. The pages are tested in e2e/ai-registry.spec.ts and against the
// drawing in e2e/admin-visual-ai-registry.spec.ts. All text here is invented for the test.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const feature = (over: Partial<RegistryFeature>): RegistryFeature => ({
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
  example_text: "",
  example_state: "none",
  example_set_by: null,
  example_set_at: null,
  fields_updated_at: null,
  fields_updated_by: null,
  ...over,
});

const version = (
  key: string,
  number: number,
  state: "active" | "draft",
  body = `${key} v${number}`,
): PromptVersionRow => ({
  key,
  version: number,
  active: state === "active",
  body,
  params: {},
  note: "",
  created_at: "2026-11-20T10:00:00Z",
  activated_at: state === "draft" ? null : "2026-11-20T10:00:00Z",
  category: key === "stuck_story" ? "runtime" : "pipeline",
});

const row = (over: Partial<RegistryRow>): RegistryRow => {
  const base = {
    slug: "x",
    featureId: "P-01",
    name: "Name",
    category: "pipeline" as const,
    where: "",
    requirement: "",
    prompts: [],
    status: "exploring" as const,
    exampleState: "none" as const,
    ...over,
  };
  // As registryRow makes it: every word the row shows.
  const search = `${base.featureId} ${base.name} ${CATEGORY_LABEL[base.category]} ${base.where}`;
  return { ...base, search: search.toLowerCase() };
};

describe("registry table (#474, FR-AIREG-1)", () => {
  it("test_474_ac1_ids_sort_in_seed_order_pipeline_gate_runtime", () => {
    const ids = ["R-02", "G-01", "P-10", "R-01", "P-02", "G-05"];
    expect([...ids].sort(compareFeatureIds)).toEqual([
      "P-02",
      "P-10",
      "G-01",
      "G-05",
      "R-01",
      "R-02",
    ]);
    expect(isFeatureId("R-03")).toBe(true);
    expect(isFeatureId("pause_message")).toBe(false);
  });

  it("test_474_ac1_a_row_has_its_fields_and_the_live_prompt_versions", () => {
    const versions = [
      version("p01_find_episodes", 1, "active"),
      version("p01_find_episodes", 2, "draft"),
    ];
    const result = registryRow(feature({}), versions);
    expect(result).toMatchObject({
      featureId: "P-01",
      name: "Find episodes",
      category: "pipeline",
      where: "Invented place",
      requirement: "Invented requirement.",
      status: "exploring",
      exampleState: "none",
      prompts: [{ key: "p01_find_episodes", published: 1, draft: 2 }],
    });
    // The search covers the category, the prompt version, the status and the example words.
    for (const words of ["pipeline", "p01_find_episodes", "v1", "exploring", "none"]) {
      expect(result.search, words).toContain(words);
    }
    // No draft: only the published version.
    expect(registryRow(feature({}), [versions[0]]).prompts).toEqual([
      { key: "p01_find_episodes", published: 1, draft: null },
    ]);
    // Prompts not readable: no version is claimed.
    expect(registryRow(feature({}), null).prompts).toEqual([
      { key: "p01_find_episodes", published: null, draft: null },
    ]);
  });

  it("test_474_ac1_filters_by_category_status_and_words_and_sorts_by_id", () => {
    const rows = [
      row({ featureId: "R-01", category: "runtime", name: "Goal split" }),
      row({ featureId: "P-02", status: "passed", where: "After selection" }),
      row({ featureId: "G-01", category: "gate", name: "Judge plan" }),
      row({ featureId: "P-01", name: "Find episodes" }),
    ];
    const ids = (found: RegistryRow[]) => found.map((item) => item.featureId);
    expect(ids(filterRegistry(rows, NO_FILTER))).toEqual(["P-01", "P-02", "G-01", "R-01"]);
    expect(ids(filterRegistry(rows, { ...NO_FILTER, descending: true }))).toEqual([
      "R-01",
      "G-01",
      "P-02",
      "P-01",
    ]);
    expect(ids(filterRegistry(rows, { ...NO_FILTER, category: "pipeline" }))).toEqual([
      "P-01",
      "P-02",
    ]);
    expect(ids(filterRegistry(rows, { ...NO_FILTER, status: "passed" }))).toEqual(["P-02"]);
    // Search looks in the id, the name and any text of the row, in any case.
    expect(ids(filterRegistry(rows, { ...NO_FILTER, query: "  AFTER sel " }))).toEqual(["P-02"]);
    expect(ids(filterRegistry(rows, { ...NO_FILTER, query: "g-01" }))).toEqual(["G-01"]);
    expect(ids(filterRegistry(rows, { ...NO_FILTER, query: "quality gate" }))).toEqual(["G-01"]);
    expect(filterRegistry(rows, { ...NO_FILTER, query: "nothing like this" })).toEqual([]);
  });
});

describe("feature detail (#474, FR-AIREG-2 and FR-AIREG-4)", () => {
  it("test_474_ac2_variables_are_marked_and_the_text_is_kept_whole", () => {
    const text = "Write for {{name}} and {{ facts }}.\nNo {single} braces.";
    const parts = promptParts(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.variable).map((part) => part.text)).toEqual([
      "{{name}}",
      "{{ facts }}",
    ]);
    expect(promptParts("")).toEqual([]);
  });

  it("test_474_ac2_published_and_draft_side_by_side_with_the_diff", () => {
    const [panel] = promptPanels(
      ["stuck_story"],
      [version("stuck_story", 3, "active", "a\nb"), version("stuck_story", 4, "draft", "a\nc")],
    );
    expect(panel.published).toEqual({ version: 3, body: "a\nb" });
    expect(panel.draft).toEqual({ version: 4, body: "a\nc" });
    expect(panel.category).toBe("runtime");
    expect(panel.diff).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "c" },
    ]);
    const [alone] = promptPanels(["stuck_story"], [version("stuck_story", 3, "active")]);
    expect(alone.draft).toBeNull();
    expect(alone.diff).toBeNull();
  });

  it("test_474_ac2_version_history_lists_field_and_status_changes_newest_first", () => {
    const people = new Map([["u1", "writer@example.invalid"]]);
    const entries = versionHistory(
      [
        {
          id: 1,
          feature_slug: "x",
          field: "where_used",
          old_value: "",
          new_value: "Here",
          changed_by: "u1",
          changed_at: "2026-11-26T10:00:00Z",
        },
      ],
      [
        {
          id: 2,
          feature_slug: "x",
          from_status: "exploring",
          to_status: "passed",
          note: null,
          changed_by: "u2aaaaaaaa",
          changed_at: "2026-11-26T11:00:00Z",
        },
      ],
      people,
    );
    expect(entries.map((entry) => [entry.time, entry.person, entry.field])).toEqual([
      ["2026-11-26 11:00", "Account u2aaaaaa", "Status"],
      ["2026-11-26 10:00", "writer@example.invalid", "Where it appears"],
    ]);
    expect(entries[0].status).toEqual({ from: "exploring", to: "passed" });
    expect(versionHistory([], [], null)).toEqual([]);
  });

  it("test_474_ac2_a_seeded_example_was_set_by_the_setup", () => {
    expect(exampleSetBy({ example_set_by: null, example_set_at: null }, null)).toEqual({
      person: "Setup",
      time: null,
      dateTime: null,
    });
    expect(
      exampleSetBy(
        { example_set_by: "u1", example_set_at: "2026-11-26T09:30:00Z" },
        new Map([["u1", "a@example.invalid"]]),
      ),
    ).toEqual({
      person: "a@example.invalid",
      time: "2026-11-26 09:30",
      dateTime: "2026-11-26T09:30:00Z",
    });
  });

  it("test_474_ac3_every_empty_field_reads_not_written_yet_and_nothing_is_invented", () => {
    const page = read("src/app/admin/ai-features/[slug]/page.tsx");
    // Every FR-AIREG-2 field is a section of the page.
    for (const heading of [
      "Purpose",
      "Requirement",
      "Prompt",
      "Output format and rules",
      "Design rationale",
      "Room to improve",
      "Confirmed example",
      "Notes",
      "Pass standard",
      "Status",
      "Version history",
      "Fix added after a rejected answer",
    ]) {
      expect(page, heading).toContain(heading);
    }
    expect(page).toContain("NotWrittenYet");
  });

  it("test_474_the_pages_read_through_the_users_own_client_and_call_no_model", () => {
    for (const file of [
      "src/app/admin/ai-features/page.tsx",
      "src/app/admin/ai-features/registry-table.tsx",
      "src/app/admin/ai-features/[slug]/page.tsx",
      "src/lib/ai-features/registry.ts",
    ]) {
      const source = read(file);
      expect(source, file).not.toMatch(/model-gateway|MODEL_API|service_role|SERVICE_ROLE/);
    }
  });
});

describe("working editors stay on the Runtime rows (#474)", () => {
  it("test_474_pipeline_and_gate_rows_are_read_only_until_475", async () => {
    expect(editable({ category: "runtime" })).toBe(true);
    expect(editable({})).toBe(true);
    expect(editable({ category: "pipeline" })).toBe(false);
    expect(editable({ category: "gate" })).toBe(false);
    const calls: string[] = [];
    const deps = {
      userId: "u1",
      role: "admin" as const,
      readFeature: async () => feature({ category: "gate", feature_id: "G-01" }),
      rpc: async (name: string) => {
        calls.push(name);
        return { data: null, error: null };
      },
    };
    expect(
      await saveFeatureSections({ slug: "g01_judge_plan", loadedAt: null, sections: {} }, deps),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(
      await changeFeatureStatus({ slug: "g01_judge_plan", status: "passed", note: "" }, deps),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(calls).toEqual([]);
    // A Runtime row still saves.
    const runtime = { ...deps, readFeature: async () => feature({ category: "runtime" }) };
    expect(
      await changeFeatureStatus({ slug: "plan_split", status: "passed", note: "" }, runtime),
    ).toEqual({ ok: true });
    expect(calls).toEqual(["set_ai_feature_status"]);
  });
});
