import { featureName, formatRunTime, type AiFeatureItem } from "./admin";
import { personName, type FeatureDeps, type FeatureWriteResult, type People } from "./edit";
import {
  CATEGORY_LABEL,
  EXAMPLE_STATES,
  FIELD_LABEL,
  type ExampleHistoryRow,
  type ExampleState,
  type FieldHistoryRow,
  type RegistryCategory,
  type RegistryFeature,
} from "./registry";

// #475 (registry slice 3; docs/PRD.md section 4.14, FR-AIREG-7, AI-PAGE-EDIT, AI-EXAMPLE-CONFIRM;
// docs/decisions/0035): editing a registry row. Server code only. An admin or a writer saves the
// name and the six text fields (public.save_ai_feature_registry_fields, 20261204000000) and sets
// the example (public.set_ai_feature_example); only an admin changes the category
// (public.set_ai_feature_category). Each check here runs on the server before the call, and the
// database functions check the role again and write the history rows.

/** The text fields of the registry editor, in the order of the page and of the function. */
export const REGISTRY_TEXT_FIELDS = [
  "where_used",
  "requirement",
  "output_format",
  "design_rationale",
  "room_to_improve",
  "notes",
] as const;

export type RegistryTextField = (typeof REGISTRY_TEXT_FIELDS)[number];

/** The column limits of 20261202000000_ai_registry.sql. */
export const REGISTRY_FIELD_MAX: Record<RegistryTextField, number> = {
  where_used: 300,
  requirement: 4000,
  output_format: 4000,
  design_rationale: 4000,
  room_to_improve: 4000,
  notes: 4000,
};

/** public.ai_features.title is 120 characters at most, its bracketed prompt keys included. */
export const TITLE_MAX_LENGTH = 120;
export const EXAMPLE_MAX_LENGTH = 8000;

const SLUG = /^[a-z][a-z0-9_]*$/;

/** The bracket part of a title (" (plan_split)"), which the editor never changes (AI-PAGE-TITLES). */
export function titleKeys(title: string): string {
  return title.match(/\s*\([^)]*\)\s*$/)?.[0] ?? "";
}

function refusal(error: unknown): FeatureWriteResult {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42501") return { ok: false, error: "not-allowed" };
  if (code === "P0002") return { ok: false, error: "unknown-feature" };
  if (code === "40001") return { ok: false, error: "changed-since" };
  return { ok: false, error: "failed" };
}

type RegistryDeps = Omit<FeatureDeps, "readFeature"> & {
  readFeature: (slug: string) => Promise<RegistryFeature | null | undefined>;
};

export type RegistryFieldsWrite = {
  slug: string;
  /** fields_updated_at as the editor loaded it: a newer save by someone else is not overwritten. */
  loadedAt: string | null;
  name: string;
} & Record<RegistryTextField, string>;

/**
 * Saves the name and the six text fields of one row. Admins and writers, every category
 * (AI-PAGE-EDIT). Answers the new fields_updated_at for the editor's next save.
 */
export async function saveRegistryFields(
  write: RegistryFieldsWrite,
  deps: RegistryDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (typeof write?.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  if (typeof write.name !== "string") return { ok: false, error: "invalid" };
  if (!REGISTRY_TEXT_FIELDS.every((field) => typeof write[field] === "string")) {
    return { ok: false, error: "invalid" };
  }
  const name = write.name.trim();
  if (name === "") return { ok: false, error: "name-empty" };
  if (REGISTRY_TEXT_FIELDS.some((field) => write[field].length > REGISTRY_FIELD_MAX[field])) {
    return { ok: false, error: "field-too-long" };
  }
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  // A name may hold brackets, also at its end ("Plan (historical)"): the prompt keys follow it and
  // the page takes only the last bracket group as keys (featureName). On a title with no keys
  // group, a name ending in brackets would lose that end on the page: refused, as in the database.
  if (titleKeys(feature.title) === "" && /\([^)]*\)$/.test(name)) {
    return { ok: false, error: "name-brackets" };
  }
  if ((name + titleKeys(feature.title)).length > TITLE_MAX_LENGTH) {
    return { ok: false, error: "name-too-long" };
  }
  if ((feature.fields_updated_at ?? null) !== (write.loadedAt ?? null)) {
    return { ok: false, error: "changed-since" };
  }
  const { data, error } = await deps.rpc("save_ai_feature_registry_fields", {
    target_feature: write.slug,
    loaded_at: write.loadedAt ?? null,
    new_name: name,
    ...Object.fromEntries(REGISTRY_TEXT_FIELDS.map((field) => [`new_${field}`, write[field]])),
  });
  if (error) return refusal(error);
  return { ok: true, savedAt: typeof data === "string" ? data : null };
}

export type ExampleWrite = {
  slug: string;
  /** example_set_at as the editor loaded it. */
  loadedAt: string | null;
  text: string;
  state: string;
};

/**
 * Sets the example text and its state (none, candidate or confirmed). Any role, every category
 * (AI-EXAMPLE-CONFIRM): the database keeps every example set in its history, with who and when.
 */
export async function setFeatureExample(
  write: ExampleWrite,
  deps: RegistryDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (typeof write?.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  if (!EXAMPLE_STATES.includes(write.state as ExampleState) || typeof write.text !== "string") {
    return { ok: false, error: "invalid" };
  }
  if (write.text.length > EXAMPLE_MAX_LENGTH) return { ok: false, error: "field-too-long" };
  if (write.state !== "none" && write.text.trim() === "") {
    return { ok: false, error: "example-needs-text" };
  }
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  if ((feature.example_set_at ?? null) !== (write.loadedAt ?? null)) {
    return { ok: false, error: "changed-since" };
  }
  if (feature.example_text === write.text && feature.example_state === write.state) {
    return { ok: false, error: "example-unchanged" };
  }
  const { error } = await deps.rpc("set_ai_feature_example", {
    target_feature: write.slug,
    new_text: write.text,
    new_state: write.state,
  });
  if (error) return refusal(error);
  return { ok: true };
}

/**
 * Confirm on the feature page: the candidate example, as it is, becomes confirmed with one action
 * (AI-EXAMPLE-CONFIRM). Refused when the example changed since the page was loaded.
 */
export async function confirmFeatureExample(
  write: { slug: string; loadedAt: string | null },
  deps: RegistryDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (typeof write?.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  if ((feature.example_set_at ?? null) !== (write.loadedAt ?? null)) {
    return { ok: false, error: "changed-since" };
  }
  if (feature.example_state !== "candidate" || feature.example_text.trim() === "") {
    return { ok: false, error: "invalid" };
  }
  const { error } = await deps.rpc("set_ai_feature_example", {
    target_feature: write.slug,
    new_text: feature.example_text,
    new_state: "confirmed",
  });
  if (error) return refusal(error);
  return { ok: true };
}

/** Changes the category. The admin role only (PRD section 4.14); the database checks it again. */
export async function changeFeatureCategory(
  write: { slug: string; category: string },
  deps: RegistryDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (typeof write?.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  if (!Object.hasOwn(CATEGORY_LABEL, write.category)) return { ok: false, error: "invalid" };
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  if (feature.category === write.category) return { ok: false, error: "category-unchanged" };
  const { error } = await deps.rpc("set_ai_feature_category", {
    target_feature: write.slug,
    new_category: write.category,
  });
  if (error) return refusal(error);
  return { ok: true };
}

/** The editor's starting values: the name without its prompt keys, and the six text fields. */
export function registryEditorValues(feature: RegistryFeature) {
  return {
    name: featureName(feature.title),
    ...Object.fromEntries(REGISTRY_TEXT_FIELDS.map((field) => [field, feature[field] ?? ""])),
  } as { name: string } & Record<RegistryTextField, string>;
}

/** The history's own word for the name. */
const HISTORY_LABEL: Record<string, string> = { ...FIELD_LABEL, title: "Name" };

/** A history value as text: a string as it is, a list of (a) to (c) one line per item. */
export function historyValue(field: string, value: unknown): string {
  if (typeof value === "string") {
    if (field === "category") return CATEGORY_LABEL[value as RegistryCategory] ?? value;
    if (field === "title") return featureName(value);
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof (item as AiFeatureItem)?.text === "string" ? item.text : ""))
      .filter((text) => text !== "")
      .join("\n");
  }
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

export type FieldChange = {
  key: string;
  time: string;
  dateTime: string;
  person: string;
  field: string;
  /** "" when the field was empty ("Not written yet"). */
  from: string;
  to: string;
};

const personOf = (id: string | null, people: People) =>
  personName(id, id ? (people?.get(id) ?? null) : null);

/** FR-AIREG-7: every field change of one row, newest first, who, when, old and new. */
export function fieldChanges(rows: FieldHistoryRow[], people: People): FieldChange[] {
  return [...rows]
    .sort((left, right) => {
      const byTime = Date.parse(right.changed_at) - Date.parse(left.changed_at);
      return byTime !== 0 ? byTime : right.id - left.id;
    })
    .map((row) => ({
      key: String(row.id),
      time: formatRunTime(row.changed_at),
      dateTime: row.changed_at,
      person: personOf(row.changed_by, people),
      field: HISTORY_LABEL[row.field] ?? row.field,
      from: historyValue(row.field, row.old_value),
      to: historyValue(row.field, row.new_value),
    }));
}

export type ExampleChange = {
  key: string;
  time: string;
  dateTime: string;
  person: string;
  state: ExampleState;
  text: string;
};

/** AI-EXAMPLE-CONFIRM: every example set, newest first; a replaced example stays here. */
export function exampleChanges(rows: ExampleHistoryRow[], people: People): ExampleChange[] {
  return [...rows]
    .sort((left, right) => {
      const byTime = Date.parse(right.set_at) - Date.parse(left.set_at);
      return byTime !== 0 ? byTime : right.id - left.id;
    })
    .map((row) => ({
      key: String(row.id),
      time: formatRunTime(row.set_at),
      dateTime: row.set_at,
      person: row.set_by ? personOf(row.set_by, people) : "Setup",
      state: row.example_state,
      text: row.example_text,
    }));
}
