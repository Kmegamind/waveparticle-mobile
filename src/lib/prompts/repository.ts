import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { logEvent } from "@/lib/logging/server-log";

/**
 * The one way the app reads a prompt (#282): `getActivePrompt(key)` returns the active version of
 * a prompt from `public.prompts`, or null when there is none. Server only: the reader token never
 * reaches the browser. All active prompts are read in one call and kept for at most a minute, so a
 * new active version is used within a minute without a deploy.
 *
 * There is no default prompt in code. A missing prompt is null; the gateway then fails the call
 * and the page shows its failure screen with Retry (NO-BACKUP).
 */

export const PROMPT_KEYS = [
  "plan_split",
  "step_cards",
  "stuck_story",
  "pause_predicament",
  "rest_reply",
  "return_popup",
  "closing_line",
  "retry_hints",
  "safety_classifier",
] as const;

/**
 * Prompts the gateway uses only while they have an active version (#517, REST-TWO-CALLS). They are
 * not in the seed files (docs/ai/prompts), and a missing one is not logged as `prompt_missing`:
 * with no active `rest_reply_review` the rest chat makes its one call, as before.
 */
export const OPTIONAL_PROMPT_KEYS = ["rest_reply_review"] as const;

/** Every key the gateway can read: the seeded keys, then the optional ones. */
export const ALL_PROMPT_KEYS = [...PROMPT_KEYS, ...OPTIONAL_PROMPT_KEYS] as const;

export type PromptKey = (typeof ALL_PROMPT_KEYS)[number];

const isOptional = (key: PromptKey) => (OPTIONAL_PROMPT_KEYS as readonly string[]).includes(key);

export type PromptRow = {
  key: PromptKey;
  version: number;
  body: string;
  params: Record<string, unknown>;
};

export type PromptSource = (key: PromptKey) => Promise<PromptRow | null>;

/** A server log line. It names the key only: never prompt text, user text or the token. */
export type PromptLog = { event: "prompt_missing" | "prompt_read_failed"; key: PromptKey };

/** How long the active prompts are kept before they are read again. */
export const PROMPT_CACHE_MS = 60_000;

export function createPromptRepository(options: {
  readRows: () => Promise<PromptRow[]>;
  cacheMs?: number;
  now?: () => number;
  log?: (event: PromptLog) => void;
}): { getActivePrompt: PromptSource } {
  const cacheMs = options.cacheMs ?? PROMPT_CACHE_MS;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  let cache: { rows: Map<PromptKey, PromptRow>; readAt: number } | null = null;
  let reading: Promise<Map<PromptKey, PromptRow>> | null = null;

  async function activeRows(): Promise<Map<PromptKey, PromptRow>> {
    if (cache && now() - cache.readAt < cacheMs) return cache.rows;
    // Calls that arrive together share one read.
    reading ??= options
      .readRows()
      .then((rows) => {
        const map = new Map(rows.map((row) => [row.key, row]));
        cache = { rows: map, readAt: now() };
        return map;
      })
      .finally(() => {
        reading = null;
      });
    return reading;
  }

  return {
    async getActivePrompt(key) {
      let rows: Map<PromptKey, PromptRow>;
      try {
        rows = await activeRows();
      } catch {
        // A failed read is not kept: the next call reads again.
        log({ event: "prompt_read_failed", key });
        return null;
      }
      const row = rows.get(key) ?? null;
      if (!row && !isOptional(key)) log({ event: "prompt_missing", key });
      return row;
    },
  };
}

function isPromptRow(value: unknown): value is PromptRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.key === "string" &&
    (ALL_PROMPT_KEYS as readonly string[]).includes(row.key) &&
    typeof row.version === "number" &&
    typeof row.body === "string" &&
    typeof row.params === "object" &&
    row.params !== null &&
    !Array.isArray(row.params)
  );
}

/**
 * Reads the active prompts through `get_active_prompts`, a security-definer function that answers
 * only to the server's reader token (supabase/migrations/20261115000000_prompts.sql). It uses the
 * public key and no user session; the table itself is closed to the API.
 */
/** How long one read of the prompts may take before it is given up. */
export const PROMPT_READ_TIMEOUT_MS = 5_000;

export async function readActivePromptsFromSupabase(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<PromptRow[]> {
  const env = options.env ?? process.env;
  const token = env.PROMPTS_READ_TOKEN?.trim();
  if (!token) throw new Error("PROMPTS_READ_TOKEN is not set");
  const { url, anonKey } = readSupabaseEnv(env);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: options.fetchImpl ? { fetch: options.fetchImpl } : undefined,
  });
  const { data, error } = await client
    .rpc("get_active_prompts", { reader_token: token })
    .abortSignal(AbortSignal.timeout(options.timeoutMs ?? PROMPT_READ_TIMEOUT_MS));
  if (error) throw new Error("get_active_prompts failed");
  const rows = (Array.isArray(data) ? data : []).filter(isPromptRow);
  // The function answers a wrong or unregistered token with no rows and no error. That is a failed
  // read (not cached, logged as such), not "every prompt is missing".
  if (rows.length === 0) throw new Error("no active prompts: check PROMPTS_READ_TOKEN");
  return rows;
}

function logToServer(event: PromptLog) {
  logEvent("prompts", event);
}

const serverRepository = createPromptRepository({
  readRows: () => readActivePromptsFromSupabase(),
  log: logToServer,
});

/** The active version of a prompt, or null. Server only. */
export const getActivePrompt: PromptSource = serverRepository.getActivePrompt;
