import type { PromptVersionRow } from "@/lib/prompts/admin";
import { lineDiff, type DiffLine } from "@/lib/prompts/diff";
import {
  AI_FEATURE_STATUS_LABEL,
  featureName,
  featurePrompts,
  formatRunTime,
  type AiFeatureRow,
  type AiFeatureStatus,
} from "./admin";
import { personName, type People, type StatusHistoryRow } from "./edit";
import {
  CATEGORY_LABEL,
  EXAMPLE_STATE_LABEL,
  type ExampleState,
  type RegistryCategory,
  type RegistryPrompt,
  type RegistryRow,
} from "./registry-filter";

export * from "./registry-filter";

// #474 (registry slice 2; docs/PRD.md section 4.14, FR-AIREG-1 to FR-AIREG-4): what the registry
// table (/admin/ai-features) and the feature detail (/admin/ai-features/<slug>) show, as drawn in
// docs/design/prototype/admin-ai-features.html (#reg-registry, #reg-feature). Server code, read
// only. Every text comes from the database: the registry columns of public.ai_features
// (20261202000000_ai_registry.sql) and the prompt texts, live, from public.prompts through
// public.list_prompt_versions. An empty field is "Not written yet" (FR-AIREG-4).

/** One row of public.ai_features with the registry columns of 20261202000000_ai_registry.sql. */
export type RegistryFeature = AiFeatureRow & {
  feature_id: string;
  category: RegistryCategory;
  where_used: string;
  requirement: string;
  output_format: string;
  design_rationale: string;
  room_to_improve: string;
  notes: string;
  example_text: string;
  example_state: ExampleState;
  example_set_by: string | null;
  example_set_at: string | null;
  fields_updated_at: string | null;
  fields_updated_by: string | null;
};

/** One row of public.ai_feature_field_history. */
export type FieldHistoryRow = {
  id: number;
  feature_slug: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_at: string;
};

/** One row of public.ai_feature_example_history. */
export type ExampleHistoryRow = {
  id: number;
  feature_slug: string;
  example_text: string;
  example_state: ExampleState;
  set_by: string | null;
  set_at: string;
};

/** The field names of the field history, in the words of the detail page's sections. */
export const FIELD_LABEL: Record<string, string> = {
  category: "Category",
  where_used: "Where it appears",
  requirement: "Requirement",
  output_format: "Output format and rules",
  design_rationale: "Design rationale",
  room_to_improve: "Room to improve",
  notes: "Notes",
  purpose: "Purpose",
  pass_questions: "Pass standard",
  approach: "Current approach",
};

/** One row of the registry table, its prompt versions read live (null: prompts not readable). */
export function registryRow(
  feature: RegistryFeature,
  versions: PromptVersionRow[] | null,
): RegistryRow {
  const prompts = (feature.prompt_keys ?? []).map((key): RegistryPrompt => {
    if (versions === null) return { key, published: null, draft: null };
    const [prompt] = featurePrompts([key], versions);
    return {
      key,
      published: prompt.published?.version ?? null,
      draft: prompt.draft?.version ?? null,
    };
  });
  const row = {
    slug: feature.slug,
    featureId: feature.feature_id,
    name: featureName(feature.title),
    category: feature.category,
    where: feature.where_used ?? "",
    requirement: feature.requirement ?? "",
    prompts,
    status: feature.status,
    exampleState: feature.example_state ?? "none",
  };
  const search = [
    row.featureId,
    row.name,
    CATEGORY_LABEL[row.category] ?? "",
    row.where,
    row.requirement,
    ...prompts.flatMap((prompt) => [
      prompt.key,
      prompt.published === null ? "" : `v${prompt.published}`,
    ]),
    AI_FEATURE_STATUS_LABEL[row.status] ?? "",
    EXAMPLE_STATE_LABEL[row.exampleState] ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return { ...row, search };
}

/** The prompt panel of one key: published and draft side by side, and the diff of the two. */
export type PromptPanel = {
  key: string;
  published: { version: number; body: string } | null;
  draft: { version: number; body: string } | null;
  /** The draft against the published text; null when there is no draft. */
  diff: DiffLine[] | null;
  category: RegistryCategory | null;
};

export function promptPanels(keys: string[], versions: PromptVersionRow[]): PromptPanel[] {
  return featurePrompts(keys, versions).map((prompt) => ({
    ...prompt,
    diff: prompt.draft ? lineDiff(prompt.published?.body ?? "", prompt.draft.body) : null,
    category: versions.find((row) => row.key === prompt.key)?.category ?? null,
  }));
}

/** One line of the Version history: a field change or a status change, newest first. */
export type VersionEntry = {
  key: string;
  time: string;
  dateTime: string;
  person: string;
  field: string;
  /** For a status change: from and to. */
  status: { from: AiFeatureStatus | null; to: AiFeatureStatus } | null;
};

const personOf = (id: string | null, people: People) =>
  personName(id, id ? (people?.get(id) ?? null) : null);

/**
 * FR-AIREG-7, read side: every field change and every status change of one feature, newest first,
 * with who made it (by email where public.list_ai_feature_people gives it, as Publish history).
 */
export function versionHistory(
  fields: FieldHistoryRow[],
  statuses: StatusHistoryRow[],
  people: People,
): VersionEntry[] {
  const entries: VersionEntry[] = [
    ...fields.map((row) => ({
      key: `field-${row.id}`,
      time: formatRunTime(row.changed_at),
      dateTime: row.changed_at,
      person: personOf(row.changed_by, people),
      field: FIELD_LABEL[row.field] ?? row.field,
      status: null,
    })),
    ...statuses.map((row) => ({
      key: `status-${row.id}`,
      time: formatRunTime(row.changed_at),
      dateTime: row.changed_at,
      person: personOf(row.changed_by, people),
      field: "Status",
      status: { from: row.from_status, to: row.to_status },
    })),
  ];
  return entries.sort((left, right) => Date.parse(right.dateTime) - Date.parse(left.dateTime));
}

/** Who set the example and when; "Setup" for a seeded example (no account, no time). */
export function exampleSetBy(
  feature: Pick<RegistryFeature, "example_set_by" | "example_set_at">,
  people: People,
): { person: string; time: string | null; dateTime: string | null } {
  return {
    person: feature.example_set_by ? personOf(feature.example_set_by, people) : "Setup",
    time: feature.example_set_at ? formatRunTime(feature.example_set_at) : null,
    dateTime: feature.example_set_at,
  };
}
