import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CrisisPage } from "@/app/safety/crisis-page";
import { PrivacyNotice } from "@/app/privacy/privacy-notice";
import { historyItemName } from "@/lib/admin/history-names";
import {
  checkIsDue,
  hotlineList,
  hotlineVersions,
  newestDraft,
  parseHotlineDraft,
  writeHotline,
  type HotlineDraftInput,
} from "@/lib/hotlines/admin";
import { entryOfRow, type HotlineRow } from "@/lib/hotlines/repository";
import { setHelpCountry } from "@/lib/me/profile";
import { publishHistoryEntries } from "@/lib/publish-history/admin";
import {
  asCopy,
  contactHref,
  COUNTRY_CODES,
  countryList,
  countryName,
  DIRECTORY,
  entryLine,
  HELP_LINE_KEY,
  readHelpLineCopy,
  removeHelpLineCopy,
  s1State,
  writeHelpLineCopy,
  type HotlineEntry,
} from "@/lib/safety/help-lines";

// #118 (US-SAF-5): help lines by region. SAFETY-REGION, SAFETY-REGION-STORE, SAFETY-DIRECTORY,
// HOTLINES in docs/DECISIONS.md; the screens S1-0, S1-E, S1-N, ME-REGION, ADM-14 and ADM-15.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const US: HotlineEntry = {
  country: "US",
  serviceName: null,
  primary: { kind: "phone", value: "988" },
  secondary: { kind: "text", value: "988" },
  note: null,
};

const row = (over: Partial<HotlineRow> = {}): HotlineRow => ({
  country: "US",
  version: 1,
  service_name: null,
  primary_kind: "phone",
  primary_value: "988",
  secondary_kind: "text",
  secondary_value: "988",
  note: null,
  checked_on: "2026-11-23",
  checked_by: "the product owner",
  published: true,
  created_at: "2026-11-23T00:00:00Z",
  published_at: "2026-11-23T00:00:00Z",
  ...over,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("#118 AC2 S1-0 when no country is known: no default country", () => {
  it("is S1-0 with no copy, no country, an unknown code or an unreadable copy", () => {
    expect(s1State(null)).toEqual({ state: "none" });
    expect(s1State({ country: null, entry: null })).toEqual({ state: "none" });
    expect(s1State({ country: "XX", entry: null })).toEqual({ state: "none" });
    expect(readHelpLineCopy(memoryStorage({ [HELP_LINE_KEY]: "not json" }))).toBeNull();
    expect(readHelpLineCopy(null)).toBeNull();
  });

  it("the server HTML of S1 is S1-0: the directory, the labelled US line and Choose your country", () => {
    const html = renderToStaticMarkup(createElement(CrisisPage, { onBack: () => undefined }));
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(html).toContain('data-s1="none"');
    expect(text).toContain("If you are in the United States: call or text 988.");
    expect(html).toMatch(/<a[^>]*href="\/me\/country"[^>]*>Choose your country<\/a>/);
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/findahelpline.com"[^>]*>Find A Helpline: findahelpline.com<\/a>/,
    );
    // Get support now opens the directory; there is no unlabelled US entry and no "Help in".
    expect(html).toMatch(/<a class="button-filled" href="https:\/\/findahelpline.com"/);
    expect(text).not.toContain("Help in");
    expect(html).not.toMatch(/tel:|sms:/);
    // Two buttons only: the directory and Choose your country are text links.
    expect(html.match(/class="button-(filled|tinted)"/g)).toHaveLength(2);
  });
});

describe("#118 AC1 AC3 S1-E and S1-N from the phone copy", () => {
  it("a chosen country with an entry is S1-E; without one it is S1-N", () => {
    expect(s1State({ country: "US", entry: US })).toEqual({
      state: "entry",
      country: "US",
      entry: US,
    });
    expect(s1State({ country: "FR", entry: null })).toEqual({ state: "no-entry", country: "FR" });
    // An entry of another country is not shown as this country's help line.
    expect(s1State({ country: "FR", entry: US })).toEqual({ state: "no-entry", country: "FR" });
  });

  it("the US entry reads Call or text 988, with tel: and sms: links and no service name", () => {
    expect(entryLine(US)).toBe("Call or text 988");
    expect(contactHref(US.primary)).toBe("tel:988");
    expect(contactHref(US.secondary!)).toBe("sms:988");
    expect(contactHref({ kind: "web", value: "https://example.org/help" })).toBe(
      "https://example.org/help",
    );
    expect(entryOfRow(row())).toEqual(US);
  });

  it("the copy is written, read and removed at sign out; a bad entry is dropped", () => {
    const storage = memoryStorage();
    writeHelpLineCopy(storage, { country: "US", entry: US });
    expect(readHelpLineCopy(storage)).toEqual({ country: "US", entry: US });
    expect(
      asCopy({ country: "US", entry: { ...US, primary: { kind: "phone", value: "call" } } }),
    ).toEqual({
      country: "US",
      entry: null,
    });
    removeHelpLineCopy(storage);
    expect(readHelpLineCopy(storage)).toBeNull();
  });

  it("the directory is Find A Helpline at findahelpline.com", () => {
    expect(DIRECTORY).toEqual({
      name: "Find A Helpline",
      url: "https://findahelpline.com",
      label: "Find A Helpline: findahelpline.com",
    });
  });
});

describe("#118 ME-REGION: every country by its English name, stored on the account", () => {
  it("lists all 249 ISO 3166-1 codes, sorted by English name", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    const list = countryList();
    expect(list.map((country) => country.name)).toEqual(
      [...list.map((country) => country.name)].sort((a, b) => a.localeCompare(b, "en")),
    );
    expect(countryName("US")).toBe("United States");
    expect(countryName("FR")).toBe("France");
  });

  it("saves a listed code or null; anything else is refused before a write", async () => {
    const upsert = vi.fn(async () => undefined);
    const deps = { userId: "user-1", writer: { upsert } };
    expect(await setHelpCountry({ country: "FR" }, deps)).toEqual({ status: "ok" });
    expect(await setHelpCountry({ country: null }, deps)).toEqual({ status: "ok" });
    expect(await setHelpCountry({ country: "XX" }, deps)).toEqual({ status: "invalid" });
    expect(await setHelpCountry({ country: "us" }, deps)).toEqual({ status: "invalid" });
    expect(await setHelpCountry({}, deps)).toEqual({ status: "invalid" });
    expect(await setHelpCountry({ country: "US" }, { ...deps, userId: null })).toEqual({
      status: "failed",
    });
    expect(upsert.mock.calls).toEqual([
      ["user-1", { helpCountry: "FR" }],
      ["user-1", { helpCountry: null }],
    ]);
  });
});

describe("#118 ADM-14 ADM-15: the hotline list in the admin", () => {
  const input = (over: Partial<HotlineDraftInput> = {}): HotlineDraftInput => ({
    country: "US",
    serviceName: "",
    primaryKind: "phone",
    primaryValue: "988",
    secondaryKind: "text",
    secondaryValue: "988",
    note: "",
    checkedOn: "2026-11-24",
    checkedBy: "the product owner",
    ...over,
  });

  it("a draft needs a valid contact, a date and who checked; the name and second contact are optional", () => {
    expect(parseHotlineDraft(input())).toMatchObject({
      ok: true,
      draft: { country: "US", serviceName: null, secondary: { kind: "text", value: "988" } },
    });
    expect(parseHotlineDraft(input({ secondaryKind: "", secondaryValue: "" }))).toMatchObject({
      ok: true,
      draft: { secondary: null },
    });
    const bad = parseHotlineDraft(
      input({ country: "XX", primaryValue: "call us", primaryKind: "web", checkedBy: "" }),
    );
    expect(bad.ok).toBe(false);
    expect(bad.ok ? [] : bad.problems).toHaveLength(3);
    expect(parseHotlineDraft(input({ primaryKind: "web", primaryValue: "http://x.org" })).ok).toBe(
      false,
    );
  });

  it("only the admin role writes: a writer is refused before any call", async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    expect(
      await writeHotline({ kind: "save", input: input() }, { userId: "u", role: "writer", rpc }),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(
      await writeHotline(
        { kind: "publish", country: "US", version: 2 },
        { userId: "u", role: null, rpc },
      ),
    ).toEqual({ ok: false, error: "not-allowed" });
    expect(rpc).not.toHaveBeenCalled();
    expect(
      await writeHotline({ kind: "save", input: input() }, { userId: "u", role: "admin", rpc }),
    ).toEqual({ ok: true, version: 2 });
    expect(
      await writeHotline(
        { kind: "publish", country: "US", version: 2 },
        { userId: "u", role: "admin", rpc },
      ),
    ).toEqual({ ok: true, version: 2 });
    expect(rpc.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      "save_hotline_draft",
      "publish_hotline",
    ]);
  });

  it("lists one row per country and marks an entry not checked in 6 months as Check due", () => {
    const today = new Date("2026-11-24T12:00:00Z");
    expect(checkIsDue("2026-11-23", today)).toBe(false);
    expect(checkIsDue("2026-05-23", today)).toBe(true);
    const list = hotlineList(
      [row(), row({ version: 2, published: false, published_at: null })],
      today,
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      country: "US",
      name: "United States",
      state: "published",
      checkDue: false,
    });
  });

  it("shows the newest draft, and rolls back only to a version published before", () => {
    const versions = hotlineVersions(
      [
        row({ version: 1, published: false }),
        row({ version: 2, published: true }),
        row({ version: 3, published: false, published_at: null }),
      ],
      "US",
    );
    expect(
      versions.map((version) => [version.version, version.state, version.canRollBack]),
    ).toEqual([
      [3, "draft", false],
      [2, "published", false],
      [1, "earlier", true],
    ]);
    expect(newestDraft(versions)?.version).toBe(3);
  });

  it("Publish history names the kind Hotline, and only an admin rolls one back", () => {
    const history = [
      {
        id: 1,
        kind: "hotline",
        item_key: "US",
        version: 1,
        action: "publish",
        acted_by: null,
        acted_by_email: "a@example.invalid",
        acted_at: "2026-11-24T00:00:00Z",
        is_current: false,
      },
    ];
    expect(publishHistoryEntries(history, "admin")[0]).toMatchObject({
      kindLabel: "Hotline",
      canRollBack: true,
    });
    expect(publishHistoryEntries(history, "writer")[0].canRollBack).toBe(false);
    expect(
      historyItemName("hotline", "US", { companions: [], stories: [], promptPurpose: {} }),
    ).toBe("Hotline · United States");
  });
});

describe("#118 the migration, the seed and the privacy notice", () => {
  const sql = read("supabase/migrations/20261128000000_hotlines.sql");

  it("adds the country to profiles with no default, so it is in the export and goes with the account", () => {
    expect(sql).toMatch(/alter table public\.profiles\s+add column help_country text check/);
    expect(sql).not.toMatch(/help_country text[^;]*default/);
  });

  it("seeds only the US 988 entry, as in src/content/hotlines.json", () => {
    const seed = JSON.parse(read("src/content/hotlines.json")) as { entries: unknown[] };
    expect(seed.entries).toEqual([
      {
        country: "US",
        serviceName: null,
        primary: { kind: "phone", value: "988" },
        secondary: { kind: "text", value: "988" },
        note: null,
        checkedOn: "2026-11-23",
        checkedBy: "the product owner",
      },
    ]);
    // The one insert with literal values (the other insert is inside save_hotline_draft).
    const inserts = (sql.match(/insert into public\.hotlines[\s\S]*?;/g) ?? []).filter((insert) =>
      /values \(\s*'/.test(insert),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toContain(
      "'US', 1, null, 'phone', '988', 'text', '988', null, '2026-11-23', 'the product owner', true",
    );
  });

  it("lets only the admin role save, publish and roll back, and keeps every history kind", () => {
    for (const name of ["save_hotline_draft", "publish_hotline", "roll_back_hotline"]) {
      const body = sql.slice(sql.indexOf(`create function public.${name}`));
      expect(body.slice(0, 900), name).toContain("public.content_role() is distinct from 'admin'");
    }
    expect(sql).toContain(
      "kind in ('app_text', 'story_card', 'companion_field', 'story_field', 'prompt', 'hotline')",
    );
    expect(sql).toMatch(/when 'hotline' then exists/);
    expect(sql).toMatch(/using \(published or \(select public\.is_content_editor\(\)\)\)/);
  });

  it("the privacy notice names the country, its use, the phone copy and no location", () => {
    const html = renderToStaticMarkup(createElement(PrivacyNotice, { back: "me" }));
    const words = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(words).toContain("the country you choose under Me for help lines");
    expect(words).toContain("only to show help lines on the safety page");
    expect(words).toContain("a copy of it stays on your device");
    expect(words).toContain("We never read your location to set it.");
  });
});
