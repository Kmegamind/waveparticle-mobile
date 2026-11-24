import type { ContentRole } from "@/lib/admin/roles";

/** What a roll back answers: ok, or an error key the page puts in words. */
export type RollBackResult = { ok: true } | { ok: false; error: string; problems?: string[] };

// ADM-12 Publish history (#289, docs/decisions/0018): what the page lists and how its Roll back
// button reaches the roll back path of each kind of content. Server code only. The rows come from
// public.list_publish_history(), which answers content editors only.

/** One row as `public.list_publish_history` returns it. */
export type PublishHistoryRow = {
  id: number;
  kind: string;
  item_key: string;
  version: number;
  action: string;
  acted_by: string | null;
  acted_by_email: string | null;
  acted_at: string;
  /** The row's version is the one published now. */
  is_current: boolean;
};

/** The kinds of content whose roll back this page knows. Later phases add theirs. */
export const PUBLISH_HISTORY_KINDS = {
  app_text: "App text",
  story_card: "Story card",
  companion_field: "Companion field",
  story_field: "Story field",
  prompt: "Prompt",
  hotline: "Hotline",
} as const;
export type PublishHistoryKind = keyof typeof PUBLISH_HISTORY_KINDS;

/** How many rows the page shows, newest first. */
export const PUBLISH_HISTORY_LIMIT = 100;

/** The most rows list_publish_history returns (#313): the Companions table's Last change reads
 * this many, so a Companion's change is not pushed out by other kinds' publishes. */
export const PUBLISH_HISTORY_WIDE_LIMIT = 500;

export type PublishHistoryEntry = {
  id: number;
  kind: string;
  kindLabel: string;
  key: string;
  version: number;
  actionLabel: "Published" | "Rolled back";
  person: string;
  time: string;
  dateTime: string;
  isCurrent: boolean;
  canRollBack: boolean;
};

/** The kinds only the admin role publishes and rolls back (#304, #309, #308). */
const ADMIN_ONLY_KINDS: ReadonlySet<string> = new Set([
  "story_card",
  "companion_field",
  "story_field",
  "prompt",
  "hotline",
]);

const isKnownKind = (kind: string): kind is PublishHistoryKind =>
  Object.hasOwn(PUBLISH_HISTORY_KINDS, kind);

const TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** "11-18 23:42" in UTC, as in the admin prototype (#313): the same on the server and in every browser. */
export function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(TIME.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function personOf(row: PublishHistoryRow): string {
  if (row.acted_by_email) return row.acted_by_email;
  if (row.acted_by) return `Account ${row.acted_by.slice(0, 8)}`;
  return "Deleted account";
}

/**
 * The page's rows, newest first. Roll back only where the version is not published now, and on
 * story cards, Companion and story fields and prompts only for the admin role (#304, #309,
 * #308: only an admin publishes or rolls them back).
 */
export function publishHistoryEntries(
  rows: PublishHistoryRow[],
  role: ContentRole | null = null,
): PublishHistoryEntry[] {
  return [...rows]
    .sort((left, right) => {
      const byTime = Date.parse(right.acted_at) - Date.parse(left.acted_at);
      return byTime !== 0 ? byTime : right.id - left.id;
    })
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      kindLabel: isKnownKind(row.kind) ? PUBLISH_HISTORY_KINDS[row.kind] : row.kind,
      key: row.item_key,
      version: row.version,
      actionLabel: row.action === "roll_back" ? "Rolled back" : "Published",
      person: personOf(row),
      time: formatHistoryTime(row.acted_at),
      dateTime: row.acted_at,
      isCurrent: row.is_current,
      canRollBack:
        !row.is_current &&
        isKnownKind(row.kind) &&
        (!ADMIN_ONLY_KINDS.has(row.kind) || role === "admin"),
    }));
}

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

/** Reads the newest rows. Any failure, a refused role included, answers no rows. */
export async function readPublishHistory(
  rpc: Rpc,
  limit: number = PUBLISH_HISTORY_LIMIT,
): Promise<{ ok: boolean; rows: PublishHistoryRow[] }> {
  try {
    const { data, error } = await rpc("list_publish_history", { row_limit: limit });
    if (error || !Array.isArray(data)) return { ok: false, rows: [] };
    return { ok: true, rows: data as PublishHistoryRow[] };
  } catch {
    return { ok: false, rows: [] };
  }
}

/** The roll back path of each kind; a kind without one is refused. */
export type HistoryRollBackHandlers = Partial<
  Record<PublishHistoryKind, (key: string, version: number) => Promise<RollBackResult>>
>;

/** Runs the roll back path of the row's kind. An unknown kind is refused before any call. */
export async function rollBackHistoryItem(
  item: { kind: string; key: string; version: number },
  handlers: HistoryRollBackHandlers,
): Promise<RollBackResult> {
  const handler = isKnownKind(item.kind) ? handlers[item.kind] : undefined;
  if (!handler) return { ok: false, error: "invalid" };
  return handler(item.key, item.version);
}
