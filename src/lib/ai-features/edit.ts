import type { ContentRole } from "@/lib/admin/roles";
import { personName } from "@/lib/publish-history/admin";
import {
  AI_FEATURE_STATUSES,
  formatRunTime,
  type AiFeatureItem,
  type AiFeatureRow,
  type AiFeatureStatus,
} from "./admin";

export { personName };

// #453 (part of #430 T6; AI-PAGE-EDIT, AI-PAGE-STATUS): editing an AI feature page. Server code
// only. Writers and admins save (a) purpose, (b) pass questions and (c) current approach through
// public.save_ai_feature_sections; only an admin changes the status, through
// public.set_ai_feature_status, which writes the history row. Each check here runs on the server
// before the call, and the database functions check the role again.

/** The longest item text and note the tables accept (20261130000000_ai_features.sql). */
export const ITEM_MAX_LENGTH = 2000;
export const NOTE_MAX_LENGTH = 500;
/** More lines than any section needs; keeps a request small. */
const ITEMS_MAX = 50;

export type SectionName = "purpose" | "pass_questions" | "approach";

/**
 * One line as the editor sends it: its text, and which stored line it was (its index in the
 * section as the page loaded it), or null for a new line. The source is never sent: it is taken
 * from the stored line, so the browser cannot invent one.
 */
export type EditedItem = { from: number | null; text: string };

/**
 * A section as saved: each kept line loses "draft - owner to edit" (someone saved it) and keeps
 * its source; an emptied line is removed. Null when a line points at no stored line.
 */
export function editedSection(
  current: AiFeatureItem[],
  edited: EditedItem[],
): AiFeatureItem[] | null {
  if (!Array.isArray(edited) || edited.length > ITEMS_MAX) return null;
  const saved: AiFeatureItem[] = [];
  for (const item of edited) {
    if (!item || typeof item.text !== "string") return null;
    const { from } = item;
    if (from !== null && !(Number.isInteger(from) && from >= 0 && from < current.length)) {
      return null;
    }
    const text = item.text.trim();
    if (text === "") continue;
    saved.push({ text, source: from === null ? null : current[from].source, draft: false });
  }
  return saved;
}

type Answer = { data: unknown; error: unknown };
export type Rpc = (name: string, args: Record<string, unknown>) => Promise<Answer>;

export type FeatureDeps = {
  userId: string | null;
  role: ContentRole | null;
  /** The feature as stored now; undefined when there is none, null when it cannot be read. */
  readFeature: (slug: string) => Promise<AiFeatureRow | null | undefined>;
  rpc: Rpc;
};

export type FeatureWriteError =
  | "not-allowed"
  | "invalid"
  | "unknown-feature"
  | "too-long"
  | "note-too-long"
  | "changed-since"
  | "unchanged"
  | "failed"
  // #475: the registry editor.
  | "name-empty"
  | "name-brackets"
  | "name-unbalanced"
  | "name-too-long"
  | "field-too-long"
  | "example-needs-text"
  | "example-unchanged"
  | "category-unchanged";

export type FeatureWriteResult =
  { ok: true; savedAt?: string | null } | { ok: false; error: FeatureWriteError };

const SLUG = /^[a-z][a-z0-9_]*$/;

function refusal(error: unknown): FeatureWriteError {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42501") return "not-allowed";
  if (code === "P0002") return "unknown-feature";
  return "failed";
}

export type SectionsWrite = {
  slug: string;
  /** sections_updated_at as the editor loaded it: a newer save by someone else is not overwritten. */
  loadedAt: string | null;
  /** The sections this editor shows; the others are saved back as they are. */
  sections: Partial<Record<SectionName, EditedItem[]>>;
};

/** Saves the sections of one editor. Admins and writers (AI-PAGE-EDIT). */
export async function saveFeatureSections(
  write: SectionsWrite,
  deps: FeatureDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (typeof write.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  for (const items of Object.values(write.sections ?? {})) {
    if (
      items?.some(
        (item) => typeof item?.text === "string" && item.text.trim().length > ITEM_MAX_LENGTH,
      )
    ) {
      return { ok: false, error: "too-long" };
    }
  }
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  // #475: every row has a pass standard; Purpose and Current approach are Runtime rows only.
  const runtimeOnly =
    write.sections?.purpose !== undefined || write.sections?.approach !== undefined;
  if (runtimeOnly && !editable(feature)) return { ok: false, error: "not-allowed" };
  if ((feature.sections_updated_at ?? null) !== (write.loadedAt ?? null)) {
    return { ok: false, error: "changed-since" };
  }
  const next: Record<SectionName, AiFeatureItem[]> = {
    purpose: feature.purpose,
    pass_questions: feature.pass_questions,
    approach: feature.approach,
  };
  for (const name of Object.keys(next) as SectionName[]) {
    const edited = write.sections?.[name];
    if (edited === undefined) continue;
    const saved = editedSection(feature[name], edited);
    if (!saved) return { ok: false, error: "invalid" };
    next[name] = saved;
  }
  const { error } = await deps.rpc("save_ai_feature_sections", {
    target_feature: write.slug,
    new_purpose: next.purpose,
    new_pass_questions: next.pass_questions,
    new_approach: next.approach,
  });
  if (error) return { ok: false, error: refusal(error) };
  return { ok: true };
}

/**
 * #475: Purpose and Current approach are kept on the Runtime rows only (AI-REQUIREMENT-FIELD, the
 * drawing's #reg-feature), so their editor works on those rows only. The pass standard, the status
 * and the registry fields are edited on every row. A row without a category (before the registry
 * migration) is a Runtime row.
 */
export const editable = (feature: Pick<AiFeatureRow, "category">) =>
  !feature.category || feature.category === "runtime";

export type StatusWrite = { slug: string; status: string; note: string };

/** Changes the status with an optional note. The admin role only (AI-PAGE-STATUS). */
export async function changeFeatureStatus(
  write: StatusWrite,
  deps: FeatureDeps,
): Promise<FeatureWriteResult> {
  if (!deps.userId || deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (typeof write.slug !== "string" || !SLUG.test(write.slug)) {
    return { ok: false, error: "invalid" };
  }
  if (!AI_FEATURE_STATUSES.includes(write.status as AiFeatureStatus)) {
    return { ok: false, error: "invalid" };
  }
  const note = typeof write.note === "string" ? write.note.trim() : "";
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, error: "note-too-long" };
  const feature = await deps.readFeature(write.slug);
  if (feature === null) return { ok: false, error: "failed" };
  if (feature === undefined) return { ok: false, error: "unknown-feature" };
  if (feature.status === write.status) return { ok: false, error: "unchanged" };
  const { error } = await deps.rpc("set_ai_feature_status", {
    target_feature: write.slug,
    new_status: write.status,
    change_note: note === "" ? null : note,
  });
  if (error) return { ok: false, error: refusal(error) };
  return { ok: true };
}

/** One row of public.ai_feature_status_history. */
export type StatusHistoryRow = {
  id: number;
  feature_slug: string;
  from_status: AiFeatureStatus;
  to_status: AiFeatureStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type StatusHistoryEntry = {
  key: string;
  time: string;
  dateTime: string;
  person: string;
  /** Null for the setup row: the status the feature started with. */
  from: AiFeatureStatus | null;
  to: AiFeatureStatus;
  note: string | null;
};

/** Account id → email, from public.list_ai_feature_people; null when it could not be read. */
export type People = Map<string, string | null> | null;

const personOf = (id: string | null, people: People) =>
  personName(id, id ? (people?.get(id) ?? null) : null);

/**
 * The status history, newest first, ending with the setup row: the status every feature started
 * with (the oldest change's "from", or the status now when nothing changed yet), at creation.
 */
export function statusHistory(
  feature: AiFeatureRow,
  rows: StatusHistoryRow[],
  people: People,
): StatusHistoryEntry[] {
  const sorted = [...rows].sort((left, right) => {
    const byTime = Date.parse(right.changed_at) - Date.parse(left.changed_at);
    return byTime !== 0 ? byTime : right.id - left.id;
  });
  const start = sorted.at(-1)?.from_status ?? feature.status;
  const created = feature.created_at ?? null;
  return [
    ...sorted.map((row) => ({
      key: String(row.id),
      time: formatRunTime(row.changed_at),
      dateTime: row.changed_at,
      person: personOf(row.changed_by, people),
      from: row.from_status,
      to: row.to_status,
      note: row.note,
    })),
    {
      key: "setup",
      time: created ? formatRunTime(created) : "",
      dateTime: created ?? "",
      person: "Setup",
      from: null,
      to: start,
      note: start === "exploring" ? "Every status starts as Exploring" : null,
    },
  ];
}

/** When (a) to (c) were last saved in the admin, and by whom; null before the first save. */
export function lastSave(feature: AiFeatureRow, people: People) {
  if (!feature.sections_updated_at) return null;
  return {
    time: formatRunTime(feature.sections_updated_at),
    dateTime: feature.sections_updated_at,
    person: personOf(feature.sections_updated_by ?? null, people),
  };
}

/** Reads public.list_ai_feature_people for one feature; null when it cannot be read. */
export async function readFeaturePeople(rpc: Rpc, slug: string): Promise<People> {
  try {
    const { data, error } = await rpc("list_ai_feature_people", { target_feature: slug });
    if (error || !Array.isArray(data)) return null;
    return new Map(
      (data as { user_id: string; email: string | null }[]).map((row) => [row.user_id, row.email]),
    );
  } catch {
    return null;
  }
}
