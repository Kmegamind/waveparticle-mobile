import type { ContentRole } from "@/lib/admin/roles";
import {
  contactIsValid,
  countryName,
  isCountryCode,
  type ContactKind,
} from "@/lib/safety/help-lines";
import type { HotlineRow } from "./repository";

/**
 * ADM-14 and ADM-15 (#118, HOTLINES): the hotline list and one entry in the admin. Only the admin
 * role saves, publishes and rolls back; writers read. Every check runs here on the server and again
 * in the database functions (supabase/migrations/20261128000000_hotlines.sql). Pure apart from the
 * `rpc` the caller passes.
 */

/** An entry not checked within this many months is marked "Check due" (FLOW ADM-14). */
export const CHECK_DUE_MONTHS = 6;

export type VersionState = "published" | "draft" | "earlier";

export type HotlineVersionView = {
  version: number;
  state: VersionState;
  row: HotlineRow;
  canRollBack: boolean;
};

export type HotlineListRow = {
  country: string;
  name: string;
  shown: HotlineRow;
  state: "published" | "draft";
  checkDue: boolean;
};

/** True when `checkedOn` (YYYY-MM-DD) is more than CHECK_DUE_MONTHS before `today`. */
export function checkIsDue(checkedOn: string, today: Date): boolean {
  const checked = new Date(`${checkedOn}T00:00:00Z`);
  if (Number.isNaN(checked.getTime())) return true;
  const limit = new Date(today);
  limit.setUTCMonth(limit.getUTCMonth() - CHECK_DUE_MONTHS);
  return checked < limit;
}

/** One row per country: the published version, or the newest draft when none is published. */
export function hotlineList(rows: HotlineRow[], today: Date): HotlineListRow[] {
  const byCountry = new Map<string, HotlineRow[]>();
  for (const row of rows) byCountry.set(row.country, [...(byCountry.get(row.country) ?? []), row]);
  return [...byCountry.entries()]
    .map(([country, versions]) => {
      const sorted = [...versions].sort((a, b) => b.version - a.version);
      const published = sorted.find((row) => row.published);
      const shown = published ?? sorted[0];
      return {
        country,
        name: countryName(country),
        shown,
        state: published ? ("published" as const) : ("draft" as const),
        checkDue: checkIsDue(shown.checked_on, today),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** The versions of one country, newest first, with their state and whether they can come back. */
export function hotlineVersions(rows: HotlineRow[], country: string): HotlineVersionView[] {
  const own = rows.filter((row) => row.country === country).sort((a, b) => b.version - a.version);
  const hasPublished = own.some((row) => row.published);
  const newestPublishedVersion = own.find((row) => row.published)?.version ?? 0;
  return own.map((row) => {
    const state: VersionState = row.published
      ? "published"
      : row.published_at === null && row.version > newestPublishedVersion
        ? "draft"
        : "earlier";
    return {
      version: row.version,
      state,
      row,
      canRollBack: hasPublished && !row.published && row.published_at !== null,
    };
  });
}

/** The newest version that is newer than the published one and was never published. */
export function newestDraft(versions: HotlineVersionView[]): HotlineVersionView | null {
  return versions.find((version) => version.state === "draft") ?? null;
}

/**
 * #448: what Save draft sends for one field of ADM-15. A one-line field shows a stored value with
 * its line breaks dropped, so an untouched field (its text still as shown) sends the stored value
 * itself, and editing never changes a value the user did not change. An edited field sends what
 * was typed.
 */
export function sentValue(stored: string | null, typed: string): string {
  const shown = (stored ?? "").replace(/[\r\n]/g, "");
  return typed === shown ? (stored ?? "") : typed;
}

export type HotlineDraftInput = {
  country: string;
  serviceName: string;
  primaryKind: string;
  primaryValue: string;
  secondaryKind: string;
  secondaryValue: string;
  note: string;
  checkedOn: string;
  checkedBy: string;
};

export type HotlineDraft = {
  country: string;
  serviceName: string | null;
  primary: { kind: ContactKind; value: string };
  secondary: { kind: ContactKind; value: string } | null;
  note: string | null;
  checkedOn: string;
  checkedBy: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The draft, or the problems in words. The secondary contact is optional; both parts or none. */
export function parseHotlineDraft(
  input: HotlineDraftInput,
): { ok: true; draft: HotlineDraft } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const country = text(input.country).toUpperCase();
  if (!isCountryCode(country)) problems.push("Choose a country from the list.");
  const serviceName = text(input.serviceName);
  if (serviceName.length > 120) problems.push("The service name is longer than 120 characters.");
  const primary = { kind: text(input.primaryKind), value: text(input.primaryValue) };
  if (!contactIsValid(primary)) {
    problems.push("The main contact needs a phone or text number (digits) or an https address.");
  }
  const secondaryKind = text(input.secondaryKind);
  const secondaryValue = text(input.secondaryValue);
  const secondary =
    secondaryKind || secondaryValue ? { kind: secondaryKind, value: secondaryValue } : null;
  if (secondary && !contactIsValid(secondary)) {
    problems.push(
      "The second contact needs a phone or text number (digits) or an https address, or leave both its fields empty.",
    );
  }
  const note = text(input.note);
  if (note.length > 200) problems.push("The note is longer than 200 characters.");
  const checkedOn = text(input.checkedOn);
  if (!DATE.test(checkedOn) || Number.isNaN(Date.parse(`${checkedOn}T00:00:00Z`))) {
    problems.push("Give the date the entry was last checked.");
  }
  const checkedBy = text(input.checkedBy);
  if (checkedBy.length === 0 || checkedBy.length > 120) problems.push("Say who checked the entry.");
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    draft: {
      country,
      serviceName: serviceName || null,
      primary: primary as { kind: ContactKind; value: string },
      secondary: secondary as { kind: ContactKind; value: string } | null,
      note: note || null,
      checkedOn,
      checkedBy,
    },
  };
}

export type HotlineWrite =
  | { kind: "save"; input: HotlineDraftInput }
  | { kind: "publish" | "roll_back"; country: string; version: number };

export type HotlineWriteError = "not-allowed" | "invalid" | "checks-failed" | "failed";

export type HotlineWriteResult =
  { ok: true; version?: number } | { ok: false; error: HotlineWriteError; problems?: string[] };

type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

/** Runs a save, publish or roll back for the admin role; anyone else is refused before any call. */
export async function writeHotline(
  write: HotlineWrite,
  deps: { userId: string | null; role: ContentRole | null; rpc: Rpc },
): Promise<HotlineWriteResult> {
  if (!deps.userId || deps.role !== "admin") return { ok: false, error: "not-allowed" };
  if (write.kind === "save") {
    const parsed = parseHotlineDraft(write.input);
    if (!parsed.ok) return { ok: false, error: "checks-failed", problems: parsed.problems };
    const { draft } = parsed;
    const { data, error } = await deps.rpc("save_hotline_draft", {
      entry_country: draft.country,
      entry_service_name: draft.serviceName,
      entry_primary_kind: draft.primary.kind,
      entry_primary_value: draft.primary.value,
      entry_secondary_kind: draft.secondary?.kind ?? null,
      entry_secondary_value: draft.secondary?.value ?? null,
      entry_note: draft.note,
      entry_checked_on: draft.checkedOn,
      entry_checked_by: draft.checkedBy,
    });
    if (error) return { ok: false, error: "failed" };
    return { ok: true, version: typeof data === "number" ? data : undefined };
  }
  if (!isCountryCode(write.country) || !Number.isInteger(write.version) || write.version < 1) {
    return { ok: false, error: "invalid" };
  }
  const name = write.kind === "publish" ? "publish_hotline" : "roll_back_hotline";
  const { error } = await deps.rpc(name, {
    entry_country: write.country,
    entry_version: write.version,
  });
  return error ? { ok: false, error: "failed" } : { ok: true, version: write.version };
}
