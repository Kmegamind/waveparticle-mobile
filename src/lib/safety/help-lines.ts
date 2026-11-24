/**
 * Help lines by region (#118, US-SAF-5; DECISIONS SAFETY-REGION, SAFETY-REGION-STORE,
 * SAFETY-DIRECTORY, HOTLINES). Pure and safe in the browser: the country codes and names, how an
 * entry reads on S1, and the copy kept on the phone so S1 works offline.
 *
 * The app never reads a location and has no default country. With no country, or no readable
 * copy, S1 shows S1-0: the international directory and the labelled US line, written here in the
 * code, never an unlabelled US entry.
 */

/** The international directory (SAFETY-DIRECTORY): linked, never embedded. */
export const DIRECTORY = {
  name: "Find A Helpline",
  url: "https://findahelpline.com",
  label: "Find A Helpline: findahelpline.com",
} as const;

/** S1-0's labelled line (owner answer of 2026-11-23), shown when no country is known. */
export const US_LINE = { label: "If you are in the United States:", text: "call or text 988." };

export type ContactKind = "phone" | "text" | "web";
export type Contact = { kind: ContactKind; value: string };

/** One published hotline entry as S1 shows it (CONTENT_MODEL 2.16). The name is optional. */
export type HotlineEntry = {
  country: string;
  serviceName: string | null;
  primary: Contact;
  secondary: Contact | null;
  note: string | null;
};

/**
 * What the phone keeps (SAFETY-REGION-STORE): whose account it belongs to, the chosen country and
 * its published entry. The user id ties the copy to one account, so another person's country is
 * never shown (review of #406, I-1).
 */
export type HelpLineCopy = { userId: string; country: string | null; entry: HotlineEntry | null };

/** ISO 3166-1 alpha-2, every officially assigned code. */
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR " +
  "BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ " +
  "EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW " +
  "GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY " +
  "KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV " +
  "MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
  "QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG " +
  "TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const CODES = new Set(COUNTRY_CODES);

export const isCountryCode = (value: unknown): value is string =>
  typeof value === "string" && CODES.has(value);

let displayNames: Intl.DisplayNames | null | undefined;

/** The English name of a country code ("United States"); the code itself if none is known. */
export function countryName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      displayNames = null;
    }
  }
  try {
    return displayNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country by its English name, sorted (ME-REGION). */
export function countryList(): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
}

const PHONE = /^\+?[0-9][0-9 ]{1,19}$/;
const WEB = /^https:\/\/[^\s"<>]+$/;

/** A phone or text number is digits (an optional leading +, spaces); a web address is https. */
export function contactIsValid(contact: { kind: unknown; value: unknown }): contact is Contact {
  if (typeof contact.value !== "string") return false;
  if (contact.kind === "web") return WEB.test(contact.value);
  if (contact.kind === "phone" || contact.kind === "text") return PHONE.test(contact.value);
  return false;
}

/** Where a contact opens: `tel:`, `sms:` or the https address. */
export function contactHref(contact: Contact): string {
  const digits = contact.value.replace(/ /g, "");
  if (contact.kind === "phone") return `tel:${digits}`;
  if (contact.kind === "text") return `sms:${digits}`;
  return contact.value;
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** A contact as a link label: "Call 988", "Text 988" or the web address's host. */
export function contactLabel(contact: Contact): string {
  if (contact.kind === "phone") return `Call ${contact.value}`;
  if (contact.kind === "text") return `Text ${contact.value}`;
  return host(contact.value);
}

/** The entry's main line on S1-E: "Call or text 988" when both reach the same number. */
export function entryLine(entry: HotlineEntry): string {
  const { primary, secondary } = entry;
  if (
    secondary &&
    primary.value === secondary.value &&
    ((primary.kind === "phone" && secondary.kind === "text") ||
      (primary.kind === "text" && secondary.kind === "phone"))
  ) {
    return `Call or text ${primary.value}`;
  }
  return contactLabel(primary);
}

export type S1State =
  | { state: "none" }
  | { state: "entry"; country: string; entry: HotlineEntry }
  | { state: "no-entry"; country: string };

/** S1-0, S1-E or S1-N from the phone copy; anything unreadable is S1-0 (never a US default). */
/**
 * Who is signed in, as far as this page knows: a user id, null (no session), or undefined (not
 * known yet, for example offline). Set by the shell's refresh of the copy (HelpLineSync).
 */
export type KnownSession = string | null | undefined;

/** Public pages (signed-out visitors may open them): there S1 needs a known matching session. */
export function isPublicHelpPath(pathname: string): boolean {
  return ["/try", "/safety", "/privacy", "/terms", "/auth"].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/**
 * S1-0, S1-E or S1-N from the phone copy; anything unreadable is S1-0 (never a US default). The
 * copy is used only when it belongs to the session this page knows, or, on a signed-in page while
 * the session is not known (offline), as it stands: the offline promise of SAFETY-REGION-STORE.
 */
export function s1State(
  copy: HelpLineCopy | null,
  context: { publicPage: boolean; session: KnownSession } = {
    publicPage: false,
    session: undefined,
  },
): S1State {
  if (!copy || !isCountryCode(copy.country)) return { state: "none" };
  if (context.session !== undefined && context.session !== copy.userId) return { state: "none" };
  if (context.session === undefined && context.publicPage) return { state: "none" };
  if (copy.entry && copy.entry.country === copy.country) {
    return { state: "entry", country: copy.country, entry: copy.entry };
  }
  return { state: "no-entry", country: copy.country };
}

export const HELP_LINE_KEY = "waveparticle.helpLine";
/** Sent on this page when the copy changes, so an open S1 follows (the storage event covers other tabs). */
export const HELP_LINE_EVENT = "waveparticle:help-line";

let knownSession: KnownSession = undefined;

/** The session this page load learned from the server (HelpLineSync); undefined until then. */
export function getKnownSession(): KnownSession {
  return knownSession;
}

export function setKnownSession(session: string | null): void {
  if (knownSession === session) return;
  knownSession = session;
  announce();
}

function announce() {
  try {
    window.dispatchEvent(new Event(HELP_LINE_EVENT));
  } catch {
    // Not in a browser.
  }
}

function asContact(value: unknown): Contact | null {
  if (typeof value !== "object" || value === null) return null;
  const { kind, value: text } = value as { kind?: unknown; value?: unknown };
  const contact = { kind, value: text };
  return contactIsValid(contact) ? { kind: contact.kind, value: contact.value } : null;
}

/** An entry from untrusted JSON (the phone copy or a server answer), or null. */
export function asEntry(value: unknown): HotlineEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const primary = asContact(row.primary);
  if (!isCountryCode(row.country) || !primary) return null;
  const secondary = row.secondary === null ? null : asContact(row.secondary);
  if (row.secondary !== null && !secondary) return null;
  return {
    country: row.country,
    serviceName: typeof row.serviceName === "string" && row.serviceName ? row.serviceName : null,
    primary,
    secondary,
    note: typeof row.note === "string" && row.note ? row.note : null,
  };
}

/** A copy from untrusted JSON, or null when it cannot be read. */
export function asCopy(value: unknown): HelpLineCopy | null {
  if (typeof value !== "object" || value === null) return null;
  const { userId, country, entry } = value as {
    userId?: unknown;
    country?: unknown;
    entry?: unknown;
  };
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 64) return null;
  if (country === null) return { userId, country: null, entry: null };
  if (!isCountryCode(country)) return null;
  if (entry === null) return { userId, country, entry: null };
  // An entry that cannot be read makes the whole copy unreadable: S1-0, never S1-N (review M-1).
  const parsed = asEntry(entry);
  return parsed ? { userId, country, entry: parsed } : null;
}

type CopyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This device's storage, or null when the browser blocks it. */
export function helpLineStorage(): CopyStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readHelpLineCopy(storage: CopyStorage | null): HelpLineCopy | null {
  try {
    const raw = storage?.getItem(HELP_LINE_KEY);
    return raw ? asCopy(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeHelpLineCopy(storage: CopyStorage | null, copy: HelpLineCopy): void {
  try {
    storage?.setItem(HELP_LINE_KEY, JSON.stringify(copy));
    announce();
  } catch {
    // Storage is full or blocked: S1 then shows S1-0, which is always safe.
  }
}

/** Set by /auth/callback when it starts a new session (#118, review of #406 M-B). */
export const HELP_LINE_RESET_COOKIE = "wp_help_line_reset";

/**
 * Reads and clears the callback's one-time marker; when it was there, the copy goes first. Runs
 * before the first refresh on every page, so a new session never sees the last account's copy.
 */
export function consumeHelpLineReset(
  storage: CopyStorage | null,
  doc: { cookie: string } | null = typeof document === "undefined" ? null : document,
): boolean {
  if (!doc) return false;
  const marked = doc.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${HELP_LINE_RESET_COOKIE}=`));
  if (!marked) return false;
  removeHelpLineCopy(storage);
  doc.cookie = `${HELP_LINE_RESET_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return true;
}

/** At sign out the copy goes (SAFETY-REGION-STORE): another person may use this phone. */
export function removeHelpLineCopy(storage: CopyStorage | null): void {
  try {
    storage?.removeItem(HELP_LINE_KEY);
    announce();
  } catch {
    // Nothing to do.
  }
}
