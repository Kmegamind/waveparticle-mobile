import type { SupabaseClient } from "@supabase/supabase-js";
import { readProfile } from "@/lib/me/supabase-profile";
import {
  asEntry,
  isCountryCode,
  type ContactKind,
  type HelpLineCopy,
  type HotlineEntry,
} from "@/lib/safety/help-lines";

/**
 * The hotline list (#118, HOTLINES; supabase/migrations/20261128000000_hotlines.sql), read through
 * the signed-in user's own client: published rows for everyone signed in, every version for
 * content editors (row level security). Server code only. Nothing a user typed is read or logged.
 */

/** One row of public.hotlines, as the API returns it. */
export type HotlineRow = {
  country: string;
  version: number;
  service_name: string | null;
  primary_kind: ContactKind;
  primary_value: string;
  secondary_kind: ContactKind | null;
  secondary_value: string | null;
  note: string | null;
  checked_on: string;
  checked_by: string;
  published: boolean;
  created_at: string;
  published_at: string | null;
};

export const HOTLINE_COLUMNS =
  "country, version, service_name, primary_kind, primary_value, secondary_kind, secondary_value, note, checked_on, checked_by, published, created_at, published_at";

/** A row as S1 shows it, or null when it is not a usable entry. */
export function entryOfRow(row: HotlineRow): HotlineEntry | null {
  return asEntry({
    country: row.country,
    serviceName: row.service_name,
    primary: { kind: row.primary_kind, value: row.primary_value },
    secondary:
      row.secondary_kind && row.secondary_value
        ? { kind: row.secondary_kind, value: row.secondary_value }
        : null,
    note: row.note,
  });
}

type Result = { data: unknown; error: unknown };

/** The published entry of a country, or null (none, or the read failed). */
export async function readPublishedEntry(
  client: Pick<SupabaseClient, "from">,
  country: string,
): Promise<{ ok: boolean; entry: HotlineEntry | null }> {
  try {
    const result = (await client
      .from("hotlines")
      .select(HOTLINE_COLUMNS)
      .eq("country", country)
      .eq("published", true)
      .limit(1)) as unknown as Result;
    if (result.error || !Array.isArray(result.data)) return { ok: false, entry: null };
    const row = result.data[0] as HotlineRow | undefined;
    return { ok: true, entry: row ? entryOfRow(row) : null };
  } catch {
    return { ok: false, entry: null };
  }
}

/**
 * The account's help line (SAFETY-REGION-STORE): its chosen country and that country's published
 * entry, for the copy on the phone. `ok` is false when the entry could not be read, so the phone
 * keeps the copy it has rather than losing the entry.
 */
export async function readAccountHelpLine(
  client: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<{ ok: boolean; copy: HelpLineCopy }> {
  const profile = await readProfile(client, userId);
  // A failed profile read is an error, never "no country" (review of #406, I-2).
  if (!profile.ok) return { ok: false, copy: { userId, country: null, entry: null } };
  const country = isCountryCode(profile.helpCountry) ? profile.helpCountry : null;
  if (!country) return { ok: true, copy: { userId, country: null, entry: null } };
  const { ok, entry } = await readPublishedEntry(client, country);
  return { ok, copy: { userId, country, entry } };
}

/** Every version of every entry (ADM-14, ADM-15); content editors only. */
export async function readHotlineVersions(
  client: Pick<SupabaseClient, "from">,
): Promise<{ ok: boolean; rows: HotlineRow[] }> {
  try {
    const result = (await client
      .from("hotlines")
      .select(HOTLINE_COLUMNS)
      .order("country", { ascending: true })
      .order("version", { ascending: false })) as unknown as Result;
    if (result.error || !Array.isArray(result.data)) return { ok: false, rows: [] };
    return { ok: true, rows: result.data as HotlineRow[] };
  } catch {
    return { ok: false, rows: [] };
  }
}
