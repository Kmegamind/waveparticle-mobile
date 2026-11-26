import type { ContentRole } from "@/lib/admin/roles";
import {
  APP_TEXT_DEFAULTS,
  APP_TEXT_KEYS,
  isAppTextKey,
  screenOf,
  type AppTextKey,
} from "./catalog";

// The App text admin page (ADM-07, #288): what it lists, and the server-side writes behind its
// buttons. Server code only. The database checks the role again in every function it calls.

/** One version row as an editor reads it from `public.app_text`. */
export type AppTextVersionRow = {
  key: string;
  version: number;
  body: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

export type AppTextVersionState = "published" | "draft" | "earlier";

export type AppTextAdminRow = {
  key: AppTextKey;
  screen: string;
  defaultText: string;
  published: { version: number; body: string } | null;
  /** The newest version newer than the published one, if any. */
  draft: { version: number; body: string } | null;
  /** Newest first. Roll back is offered on every version that was published before. */
  versions: { version: number; body: string; state: AppTextVersionState; canRollBack: boolean }[];
};

/** The longest text the database takes (the migration's check). */
export const APP_TEXT_MAX_LENGTH = 1000;

/** Every key the app reads, in catalog order, with its versions. Rows of unknown keys are left out. */
export function appTextAdminRows(rows: AppTextVersionRow[]): AppTextAdminRow[] {
  return APP_TEXT_KEYS.map((key) => {
    const versions = rows
      .filter((row) => row.key === key)
      .sort((left, right) => right.version - left.version);
    const current = versions.find((row) => row.published) ?? null;
    // The newer draft: the newest version above the published one that was never published. A
    // version published before and rolled back past is an earlier version, not a draft (#289).
    const draft =
      versions.find(
        (row) =>
          !row.published &&
          row.published_at === null &&
          (!current || row.version > current.version),
      ) ?? null;
    return {
      key,
      screen: screenOf(key),
      defaultText: APP_TEXT_DEFAULTS[key],
      published: current ? { version: current.version, body: current.body } : null,
      draft: draft ? { version: draft.version, body: draft.body } : null,
      versions: versions.map((row) => {
        const state: AppTextVersionState = row.published
          ? "published"
          : row.published_at !== null
            ? "earlier"
            : "draft";
        return {
          version: row.version,
          body: row.body,
          state,
          // Any version published before can be published again (#289, docs/decisions/0018).
          canRollBack: state === "earlier" && current !== null,
        };
      }),
    };
  });
}

export type AppTextWrite =
  | { kind: "save"; key: string; body: string }
  | { kind: "publish" | "roll_back"; key: string; version: number };

export type AppTextWriteResult =
  | { ok: true; version?: number }
  | { ok: false; error: "not-allowed" | "invalid" | "blank" | "too-long" | "failed" };

const FUNCTIONS = {
  save: "save_app_text_draft",
  publish: "publish_app_text",
  roll_back: "roll_back_app_text",
} as const;

/**
 * Runs one write for the App text page. It refuses without a signed-in account with a role, an
 * unknown key, a blank or too long text and a version that is not a whole number of at least 1,
 * before any database call. A publish or roll back clears the reader's cache, so this server shows
 * the change at once.
 */
export async function writeAppText(
  write: AppTextWrite,
  deps: {
    userId: string | null;
    role: ContentRole | null;
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
    clearCache: () => void;
  },
): Promise<AppTextWriteResult> {
  if (!deps.userId || !deps.role) return { ok: false, error: "not-allowed" };
  if (!isAppTextKey(write.key)) return { ok: false, error: "invalid" };

  if (write.kind === "save") {
    if (typeof write.body !== "string" || write.body.trim() === "") {
      return { ok: false, error: "blank" };
    }
    if (write.body.length > APP_TEXT_MAX_LENGTH) return { ok: false, error: "too-long" };
    const { data, error } = await deps.rpc(FUNCTIONS.save, {
      text_key: write.key,
      text_body: write.body,
    });
    if (error) return { ok: false, error: "failed" };
    return typeof data === "number" ? { ok: true, version: data } : { ok: true };
  }

  if (!Number.isInteger(write.version) || write.version < 1) return { ok: false, error: "invalid" };
  const { error } = await deps.rpc(FUNCTIONS[write.kind], {
    text_key: write.key,
    text_version: write.version,
  });
  if (error) return { ok: false, error: "failed" };
  deps.clearCache();
  return { ok: true };
}

// #445: the page as the prototype draws it. Each key is one line; its text is edited in place, and
// "Publish changes" in the header publishes every newer draft at once (admin only), one key at a
// time through the same publish as the per-key button.

/** The text the in-place field starts with: the newer draft, else the published text, else the
 * code default. Exactly as stored: never trimmed or changed. */
export function appTextStartText(row: AppTextAdminRow): string {
  return row.draft?.body ?? row.published?.body ?? row.defaultText;
}

/**
 * True when Save draft has something to save: the typed text (null before any typing) differs
 * exactly from the text the field started with, or the key has no row in the database at all.
 */
export function appTextCanSave(row: AppTextAdminRow, typed: string | null): boolean {
  if (!row.published && !row.draft) return true;
  return typed !== null && typed !== appTextStartText(row);
}

export type AppTextChange = { key: AppTextKey; version: number; body: string };

/** What "Publish changes" publishes: every key with a newer draft, with that draft's version. */
export function appTextChanges(rows: AppTextAdminRow[]): AppTextChange[] {
  return rows.flatMap((row) =>
    row.draft ? [{ key: row.key, version: row.draft.version, body: row.draft.body }] : [],
  );
}

export type AppTextChangeResult = { key: string; version: number; result: AppTextWriteResult };

export type PublishChangesResult =
  { ok: true; results: AppTextChangeResult[] } | { ok: false; error: "not-allowed" | "invalid" };

/**
 * Publishes the listed versions, one key at a time, with `writeAppText` (the per-key publish).
 * Admin only: a writer or an account without a role gets "not-allowed" before any call. An empty
 * list, a key listed twice or a malformed item is refused before any call.
 */
export async function publishAppTextChanges(
  items: { key: string; version: number }[],
  deps: Parameters<typeof writeAppText>[1],
): Promise<PublishChangesResult> {
  if (!deps.userId || deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (!Array.isArray(items) || items.length === 0 || items.length > APP_TEXT_KEYS.length) {
    return { ok: false, error: "invalid" };
  }
  const keys = new Set<string>();
  for (const item of items) {
    if (
      !item ||
      typeof item.key !== "string" ||
      !Number.isInteger(item.version) ||
      keys.has(item.key)
    ) {
      return { ok: false, error: "invalid" };
    }
    keys.add(item.key);
  }
  const results: AppTextChangeResult[] = [];
  for (const item of items) {
    const result = await writeAppText(
      { kind: "publish", key: item.key, version: item.version },
      deps,
    );
    results.push({ key: item.key, version: item.version, result });
  }
  return { ok: true, results };
}

/** The words for one refused App text write. */
export const APP_TEXT_PROBLEMS: Record<Exclude<AppTextWriteResult, { ok: true }>["error"], string> =
  {
    "not-allowed": "Your account cannot change app text.",
    invalid: "This key or version is not known.",
    blank: "Write a text first. An empty text is not saved.",
    "too-long": "Keep the text under 1000 characters.",
    failed: "Could not save the change. Please try again.",
  };

/** One sentence naming each key and version that was published, and each that was not, and why. */
export function publishChangesMessage(results: AppTextChangeResult[]): string {
  const done = results.filter((item) => item.result.ok);
  const refused = results.filter((item) => !item.result.ok);
  const parts: string[] = [];
  if (done.length > 0) {
    parts.push(`Published ${done.map((item) => `${item.key} v${item.version}`).join(", ")}.`);
  }
  if (refused.length > 0) {
    const list = refused.map((item) => {
      const error = item.result.ok ? "failed" : item.result.error;
      return `${item.key} v${item.version} (${APP_TEXT_PROBLEMS[error]})`;
    });
    parts.push(`Not published: ${list.join(", ")}.`);
  }
  return parts.join(" ");
}
