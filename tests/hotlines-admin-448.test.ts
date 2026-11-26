import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseHotlineDraft, sentValue } from "@/lib/hotlines/admin";

// #448: the Hotline entry editor in the prototype's layout must never change a stored value the
// user did not change (phone numbers, addresses, the country code, who and when it was checked).

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

describe("#448 Save draft sends what is stored for a field the user did not change", () => {
  it("an untouched field sends the stored value itself", () => {
    expect(sentValue("988", "988")).toBe("988");
    expect(sentValue("https://example.org/help?a=1", "https://example.org/help?a=1")).toBe(
      "https://example.org/help?a=1",
    );
    expect(sentValue(null, "")).toBe("");
  });

  it("a stored line break, which a one-line field cannot show, is kept when untouched", () => {
    // A text field drops line breaks from its value; the stored text goes back unchanged.
    expect(sentValue("Open 24 hours\nEnglish", "Open 24 hoursEnglish")).toBe(
      "Open 24 hours\nEnglish",
    );
    expect(sentValue("a\r\nb", "ab")).toBe("a\r\nb");
  });

  it("an edited field sends what was typed", () => {
    expect(sentValue("988", "989")).toBe("989");
    expect(sentValue(null, "Samaritans")).toBe("Samaritans");
  });
});

describe("#448 every seed entry round-trips through the editor's save unchanged", () => {
  const seed = JSON.parse(read("src/content/hotlines.json")) as {
    entries: {
      country: string;
      serviceName: string | null;
      primary: { kind: string; value: string };
      secondary: { kind: string; value: string } | null;
      note: string | null;
      checkedOn: string;
      checkedBy: string;
    }[];
  };

  it.each(seed.entries.map((entry) => [entry.country, entry] as const))("%s", (_code, entry) => {
    const parsed = parseHotlineDraft({
      country: entry.country,
      serviceName: sentValue(entry.serviceName, entry.serviceName ?? ""),
      primaryKind: entry.primary.kind,
      primaryValue: sentValue(entry.primary.value, entry.primary.value),
      secondaryKind: entry.secondary?.kind ?? "",
      secondaryValue: sentValue(entry.secondary?.value ?? null, entry.secondary?.value ?? ""),
      note: sentValue(entry.note, entry.note ?? ""),
      checkedOn: entry.checkedOn,
      checkedBy: sentValue(entry.checkedBy, entry.checkedBy),
    });
    expect(parsed).toStrictEqual({
      ok: true,
      draft: {
        country: entry.country,
        serviceName: entry.serviceName,
        primary: entry.primary,
        secondary: entry.secondary,
        note: entry.note,
        checkedOn: entry.checkedOn,
        checkedBy: entry.checkedBy,
      },
    });
  });
});

describe("#448 the pages follow the prototype's layout", () => {
  const list = read("src/app/admin/hotlines/page.tsx");
  const editor = read("src/app/admin/hotlines/hotline-editor.tsx");

  it("Add an entry is a full-size main button in the header action row", () => {
    expect(list).toContain("<PageHead");
    expect(list).not.toMatch(/button-small[^"]*"[^>]*>\s*Add an entry/);
  });

  it("Save draft and Publish sit in the header action row, outside the form", () => {
    expect(editor).toContain('actionsLabel={isAdmin ? "Hotline actions" : undefined}');
    expect(editor).toMatch(/form=\{formId\}/);
  });
});
