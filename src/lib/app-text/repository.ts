import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { APP_TEXT_DEFAULTS, isAppTextKey, type AppTexts } from "./catalog";
import { logEvent } from "@/lib/logging/server-log";

/**
 * The one way the app reads its own words (#288, decision APP-TEXT): `getAppTexts()` returns the
 * text to show for every key: the published row of `public.app_text`, or the default written in
 * the code when the key has no published row or the database cannot answer. A screen is never
 * blank. Server only. All published rows are read in one call and kept for at most a minute, so a
 * publish reaches phones within a minute without a deploy; a publish on this server clears the
 * cache at once.
 */

export type AppTextRow = { key: string; body: string };

/** A server log line. It never carries text. */
export type AppTextLog = { event: "app_text_read_failed" };

/** How long the published texts are kept before they are read again. */
export const APP_TEXT_CACHE_MS = 60_000;

/** How long one read may take before it is given up and the defaults are shown. */
export const APP_TEXT_READ_TIMEOUT_MS = 3_000;

function textsFrom(rows: AppTextRow[]): AppTexts {
  const texts: AppTexts = { ...APP_TEXT_DEFAULTS };
  for (const row of rows) {
    if (!isAppTextKey(row.key)) continue;
    if (typeof row.body !== "string" || row.body.trim() === "") continue;
    texts[row.key] = row.body;
  }
  return texts;
}

export function createAppTextRepository(options: {
  readRows: () => Promise<AppTextRow[]>;
  cacheMs?: number;
  now?: () => number;
  log?: (event: AppTextLog) => void;
}): { getAppTexts: () => Promise<AppTexts>; clear: () => void } {
  const cacheMs = options.cacheMs ?? APP_TEXT_CACHE_MS;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  let cache: { texts: AppTexts; readAt: number } | null = null;
  let reading: Promise<AppTexts> | null = null;
  // Bumped by clear(): a read that started before it never fills the cache.
  let generation = 0;

  async function getAppTexts(): Promise<AppTexts> {
    if (cache && now() - cache.readAt < cacheMs) return cache.texts;
    if (!reading) {
      const startedIn = generation;
      const read = options
        .readRows()
        .then((rows) => {
          const texts = textsFrom(rows);
          if (startedIn === generation) cache = { texts, readAt: now() };
          return texts;
        })
        .catch(() => {
          // A failed read is not kept: the next call reads again. The screen shows the defaults.
          log({ event: "app_text_read_failed" });
          return { ...APP_TEXT_DEFAULTS };
        })
        .finally(() => {
          if (reading === read) reading = null;
        });
      reading = read;
    }
    return reading;
  }

  return {
    getAppTexts,
    clear() {
      generation += 1;
      cache = null;
      reading = null;
    },
  };
}

/**
 * Reads every published row with the public key and no user session. The table's policy lets
 * anyone read published rows (app text is not secret); drafts stay hidden.
 */
export async function readPublishedAppText(
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<AppTextRow[]> {
  const { url, anonKey } = readSupabaseEnv(options.env ?? process.env);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: options.fetchImpl ? { fetch: options.fetchImpl } : undefined,
  });
  const { data, error } = await client
    .from("app_text")
    .select("key, body")
    .eq("published", true)
    .abortSignal(AbortSignal.timeout(options.timeoutMs ?? APP_TEXT_READ_TIMEOUT_MS));
  if (error) throw new Error("reading app_text failed");
  return Array.isArray(data) ? (data as AppTextRow[]) : [];
}

function logToServer(event: AppTextLog) {
  logEvent("app_text", event);
}

const serverRepository = createAppTextRepository({
  readRows: () => readPublishedAppText(),
  log: logToServer,
});

/** The text to show for every key: published, or the code default. Server only. */
export const getAppTexts = serverRepository.getAppTexts;

/** Drops the cached texts, so the next read shows a publish at once (on this server). */
export const clearAppTextCache = serverRepository.clear;
