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
