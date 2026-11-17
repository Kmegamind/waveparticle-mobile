import type { ContentRole } from "@/lib/admin/roles";
import { promptRowProblems } from "@/lib/model-gateway";
import type {
  PromptDetail,
  PromptVersionState,
  PromptWriteError,
} from "@/lib/admin/prompt-editor-types";
import { lineDiff, settingsText, type DiffLine } from "./diff";
import { PROMPT_KEYS, type PromptKey, type PromptRow } from "./repository";

// ADM-08 Prompts (#308, docs/decisions/0024): what the page lists and shows, and the writes behind
// its buttons. Server code only. The rows come from public.list_prompt_versions(), which answers
// content editors only. Every save is a new draft version; only the admin role publishes or rolls
// back, and only a version the gateway can use (its own row check, promptRowProblems).

export type { PromptDetail, PromptVersionState, PromptWriteError };

/** One row as `public.list_prompt_versions` returns it. */
export type PromptVersionRow = {
  key: string;
  version: number;
  active: boolean;
  body: string;
  params: Record<string, unknown>;
  note: string;
  created_at: string;
  /** The last time this version became the active one; null for a draft never active. */
  activated_at: string | null;
};

/** What each prompt is used for (docs/ai/prompts/README.md). */
export const PROMPT_PURPOSE: Record<PromptKey, string> = {
  plan_split: "The goal split into Steps",
  step_cards: "His cards for one Step, with the background card on Step 1",
  stuck_story: "His stuck situation when the person pauses (the harder one from the third Pause)",
  rest_reply: "His reply in the rest chat",
  return_popup: "His line in the return pop-up, after the rest chat or an absence",
  closing_line: "His closing line and the line he carries, on the summary",
  retry_hints: "The fix added to a prompt after a rejected answer, one per failed check",
};

/** The longest prompt text the admin saves. */
export const PROMPT_BODY_MAX_LENGTH = 20_000;
/** The longest note the admin saves. */
export const PROMPT_NOTE_MAX_LENGTH = 500;

export type PromptListRow = {
  key: PromptKey;
  purpose: string;
  active: { version: number; settings: string[] } | null;
  /** The newest draft above the active version, or null. */
  draftVersion: number | null;
};

export const isPromptKey = (key: unknown): key is PromptKey =>
  typeof key === "string" && (PROMPT_KEYS as readonly string[]).includes(key);

/** Settings as one line per value: "checks.max_words: 80", "text.situation_first: …". */
export function settingsLines(params: Record<string, unknown>, prefix = ""): string[] {
  return Object.keys(params)
    .sort()
    .flatMap((name) => {
      const value = params[name];
      const path = `${prefix}${name}`;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return settingsLines(value as Record<string, unknown>, `${path}.`);
      }
      return [`${path}: ${typeof value === "string" ? value : JSON.stringify(value)}`];
    });
}

function versionsOf(key: string, rows: PromptVersionRow[]) {
  const versions = rows
    .filter((row) => row.key === key)
    .sort((left, right) => right.version - left.version);
  const active = versions.find((row) => row.active) ?? null;
  // As app text and story cards: a version active before and rolled back past is an earlier
  // version, not a draft.
  const draft =
    versions.find(
      (row) =>
        !row.active && row.activated_at === null && (!active || row.version > active.version),
    ) ?? null;
  return { versions, active, draft };
}

const stateOf = (row: PromptVersionRow): PromptVersionState =>
  row.active ? "active" : row.activated_at !== null ? "earlier" : "draft";

/** The 7 prompts in the gateway's order, each with its active version and any newer draft. */
export function promptList(rows: PromptVersionRow[]): PromptListRow[] {
  return PROMPT_KEYS.map((key) => {
    const { active, draft } = versionsOf(key, rows);
    return {
      key,
      purpose: PROMPT_PURPOSE[key],
      active: active ? { version: active.version, settings: settingsLines(active.params) } : null,
      draftVersion: draft?.version ?? null,
    };
  });
}

const asRow = (row: PromptVersionRow): PromptRow => ({
  key: row.key as PromptKey,
  version: row.version,
  body: row.body,
  params: row.params,
});

const allAdded = (text: string): DiffLine[] =>
  text.split("\n").map((line) => ({ kind: "added", text: line }));

/** One prompt: the active version, the newest draft with its diff and problems, every version. */
export function promptDetail(key: string, rows: PromptVersionRow[]): PromptDetail | null {
  if (!isPromptKey(key)) return null;
  const { versions, active, draft } = versionsOf(key, rows);
  return {
    key,
    purpose: PROMPT_PURPOSE[key],
    active: active
      ? { version: active.version, body: active.body, params: active.params, note: active.note }
      : null,
    draft: draft
      ? {
          version: draft.version,
          body: draft.body,
          params: draft.params,
          note: draft.note,
          problems: promptRowProblems(asRow(draft)),
          bodyDiff: active ? lineDiff(active.body, draft.body) : allAdded(draft.body),
          settingsDiff: active
            ? lineDiff(settingsText(active.params), settingsText(draft.params))
            : allAdded(settingsText(draft.params)),
        }
      : null,
    versions: versions.map((row) => ({
      version: row.version,
      state: stateOf(row),
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

export type PromptWrite =
  | { kind: "save"; key: string; body: string; settings: string; note: string }
  | { kind: "publish" | "roll_back"; key: string; version: number };

export type PromptWriteResult =
  { ok: true; version?: number } | { ok: false; error: PromptWriteError; problems?: string[] };

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

/** The settings typed in the editor, or null when they are not a JSON object. */
export function parseSettings(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Runs one save, publish or roll back. Each is refused here before any database call when the
 * account, the role or the input is wrong; the database functions check the role again. Publish
 * and roll back run the gateway's row check on the stored version first.
 */
export async function writePrompt(
  write: PromptWrite,
  deps: {
    userId: string | null;
    role: ContentRole | null;
    rpc: Rpc;
    /** Every prompt version, or null when they cannot be read. */
    readVersions: () => Promise<PromptVersionRow[] | null>;
  },
): Promise<PromptWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (!isPromptKey(write.key)) return { ok: false, error: "invalid" };

  if (write.kind === "save") {
    if (typeof write.body !== "string" || write.body.trim() === "") {
      return { ok: false, error: "blank" };
    }
    if (write.body.length > PROMPT_BODY_MAX_LENGTH) return { ok: false, error: "too-long" };
    const note = typeof write.note === "string" ? write.note : "";
    if (note.length > PROMPT_NOTE_MAX_LENGTH) return { ok: false, error: "note-too-long" };
    const params = typeof write.settings === "string" ? parseSettings(write.settings) : null;
    if (!params) return { ok: false, error: "settings-json" };
    const rows = await deps.readVersions();
    if (!rows) return { ok: false, error: "failed" };
    const newest = versionsOf(write.key, rows).versions[0];
    if (
      newest &&
      newest.body === write.body &&
      newest.note === note &&
      settingsText(newest.params) === settingsText(params)
    ) {
      return { ok: false, error: "unchanged" };
    }
    const { data, error } = await deps.rpc("save_prompt_draft", {
      prompt_key: write.key,
      prompt_body: write.body,
      prompt_params: params,
      prompt_note: note,
    });
    if (error) return { ok: false, error: "failed" };
    return typeof data === "number" ? { ok: true, version: data } : { ok: true };
  }

  // Publish and roll back: the admin role only (#308 AC5).
  if (deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (!Number.isInteger(write.version) || write.version < 1) return { ok: false, error: "invalid" };
  const rows = await deps.readVersions();
  if (!rows) return { ok: false, error: "failed" };
  const target = rows.find((row) => row.key === write.key && row.version === write.version);
  if (!target) return { ok: false, error: "invalid" };
  const problems = promptRowProblems(asRow(target));
  if (problems.length > 0) return { ok: false, error: "checks-failed", problems };
  const { error } = await deps.rpc(
    write.kind === "publish" ? "publish_prompt" : "roll_back_prompt",
    { prompt_key: write.key, prompt_version: write.version },
  );
  return error ? { ok: false, error: "failed" } : { ok: true };
}

/** Reads every prompt version. Any failure, a refused role included, answers null. */
export async function readPromptVersions(rpc: Rpc): Promise<PromptVersionRow[] | null> {
  try {
    const { data, error } = await rpc("list_prompt_versions", {});
    if (error || !Array.isArray(data)) return null;
    return data as PromptVersionRow[];
  } catch {
    return null;
  }
}
