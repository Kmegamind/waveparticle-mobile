import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { companionRow } from "@/lib/admin/companion-rows";
import { historyItemName, type NameLookup } from "@/lib/admin/history-names";
import { formatHistoryTime } from "@/lib/publish-history/admin";

// #313: the admin looks like the admin prototype at desktop widths.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const lookup: NameLookup = {
  companions: [
    { id: "oppenheimer", key_code: "opp", name: "J. Robert Oppenheimer" },
    { id: "moriarty", key_code: "mor", name: "Professor Moriarty" },
  ],
  stories: [{ id: "site-search", companion_id: "oppenheimer", title: "The Canyon and the Mesa" }],
  promptPurpose: { rest_reply: "His reply in the rest chat" },
};

describe("Publish history names every row (#313 row 48)", () => {
  it("test_313_app_text_rows_name_their_screen", () => {
    expect(historyItemName("app_text", "ui.F3.fail.body", lookup)).toBe("App text · screen F3");
    expect(historyItemName("app_text", "ui.HOME-0.greeting", lookup)).toBe(
      "App text · screen HOME-0",
    );
  });

  it("test_313_card_rows_name_the_story_part_and_card", () => {
    expect(historyItemName("story_card", "crd.opp.site-search.bg", lookup)).toBe(
      "The Canyon and the Mesa · background card",
    );
    expect(historyItemName("story_card", "crd.opp.site-search.p2.c3", lookup)).toBe(
      "The Canyon and the Mesa · part 2, card 3",
    );
  });

  it("test_313_companion_field_rows_name_the_companion_and_field", () => {
    expect(historyItemName("companion_field", "chr.opp.who", lookup)).toBe(
      "J. Robert Oppenheimer · Who I am",
    );
    expect(historyItemName("companion_field", "chr.opp.name", lookup)).toBe(
      "J. Robert Oppenheimer · Name",
    );
    expect(historyItemName("companion_field", "chr.mor.tags", lookup)).toBe(
      "Professor Moriarty · Tags",
    );
    expect(historyItemName("companion_field", "chr.opp.period.2", lookup)).toBe(
      "J. Robert Oppenheimer · period 2 name",
    );
  });

  it("test_313_story_field_rows_name_the_story_and_field", () => {
    const name = (field: string) =>
      historyItemName("story_field", `opp.site-search.${field}`, lookup);
    expect(name("title")).toBe("The Canyon and the Mesa · Title");
    expect(name("period")).toBe("The Canyon and the Mesa · Period");
    expect(name("goal")).toBe("The Canyon and the Mesa · Goal sentence");
    expect(name("who")).toBe("The Canyon and the Mesa · Who I am");
    expect(name("opening")).toBe("The Canyon and the Mesa · Opening");
    expect(name("path")).toBe("The Canyon and the Mesa · Life Path description");
  });

  it("test_313_prompt_rows_name_the_prompt_purpose", () => {
    expect(historyItemName("prompt", "rest_reply", lookup)).toBe("His reply in the rest chat");
  });

  it("test_313_an_unknown_key_falls_back_to_the_kind_label", () => {
    expect(historyItemName("story_card", "crd.opp.gone-story.bg", lookup)).toBe("Story card");
    expect(historyItemName("companion_field", "chr.zzz.who", lookup)).toBe("Companion field");
    expect(historyItemName("story_field", "opp.site-search.unknown", lookup)).toBe("Story field");
    expect(historyItemName("prompt", "no_such_prompt", lookup)).toBe("Prompt");
    expect(historyItemName("app_text", "not-a-ui-key", lookup)).toBe("App text");
    expect(historyItemName("other_kind", "x", lookup)).toBe("other_kind");
  });
});

describe("Publish history short date (#313 row 47)", () => {
  it("test_313_short_date_is_month_day_hour_minute_in_utc", () => {
    expect(formatHistoryTime("2026-11-18T23:42:00Z")).toBe("11-18 23:42");
    expect(formatHistoryTime("2026-01-03T00:05:00Z")).toBe("01-03 00:05");
    expect(formatHistoryTime("2026-11-18T23:42:00-05:00")).toBe("11-19 04:42");
    expect(formatHistoryTime("not a time")).toBe("not a time");
  });
});

describe("Companions table facts (#313 row 13)", () => {
  const stories = [{ id: "site-search", companion_id: "oppenheimer" }];
  const history = [
    {
      kind: "story_card",
      item_key: "crd.opp.site-search.p1.c1",
      person: "yue@example.com",
      acted_at: "2026-11-17T10:00:00Z",
    },
    {
      kind: "companion_field",
      item_key: "chr.opp.who",
      person: "writer@example.com",
      acted_at: "2026-11-18T09:30:00Z",
    },
    {
      kind: "companion_field",
      item_key: "chr.mor.name",
      person: "other@example.com",
      acted_at: "2026-11-19T09:30:00Z",
    },
    {
      kind: "app_text",
      item_key: "ui.F3.fail.body",
      person: "a@b.c",
      acted_at: "2026-11-20T09:30:00Z",
    },
  ];

  it("test_313_a_companion_with_stories_is_published_with_his_newest_change", () => {
    expect(companionRow({ id: "oppenheimer", key_code: "opp" }, stories, history)).toEqual({
      shown: "Published",
      lastChange: "writer@example.com · 11-18",
    });
  });

  it("test_313_a_companion_without_stories_is_not_ready", () => {
    expect(companionRow({ id: "moriarty", key_code: "mor" }, stories, history)).toEqual({
      shown: "Not ready",
      lastChange: "other@example.com · 11-19",
    });
  });

  it("test_313_no_history_shows_a_dash", () => {
    expect(companionRow({ id: "dracula", key_code: "dra" }, stories, history)).toEqual({
      shown: "Not ready",
      lastChange: "—",
    });
  });

  it("test_313_a_story_field_counts_for_its_companion", () => {
    const fieldOnly = [
      {
        kind: "story_field",
        item_key: "opp.site-search.title",
        person: "yue@example.com",
        acted_at: "2026-11-16T08:00:00Z",
      },
    ];
    expect(
      companionRow({ id: "oppenheimer", key_code: "opp" }, stories, fieldOnly).lastChange,
    ).toBe("yue@example.com · 11-16");
  });
});

describe("admin tokens and shell (#313 rows 1, 2, 3, 4, 7, 9, 11)", () => {
  const tokens = () => read("src/app/tokens.css");
  const adminCss = () => {
    const css = read("src/app/globals.css");
    return css.slice(css.indexOf("/* The content admin (issue 287)"));
  };
  const block = (css: string, selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  };

  it("test_313_tokens_hold_the_prototype_light_values", () => {
    const light = block(tokens(), ".admin-shell");
    for (const [name, value] of [
      ["--adm-bg", "#f5f6f4"],
      ["--adm-panel", "#ffffff"],
      ["--adm-ink", "#1d2421"],
      ["--adm-muted", "#5f6b66"],
      ["--adm-line", "#dde2df"],
      ["--adm-soft", "#eef1ef"],
      ["--adm-accent", "#1f6f5c"],
      ["--adm-accent-soft", "#e2f0eb"],
      ["--adm-ok", "#2f7d4f"],
      ["--adm-bad", "#b23b3b"],
      ["--adm-warn", "#9a6a10"],
      ["--adm-info", "#3a5ea8"],
      // #435: each list is led by the copy next/font serves (src/app/admin/fonts.ts).
      ["--adm-font-display", 'var(--font-adm-display), "Fraunces", Georgia, serif'],
      ["--adm-font-body", 'var(--font-adm-body), "IBM Plex Sans", system-ui, sans-serif'],
      ["--adm-font-mono", 'var(--font-adm-mono), "IBM Plex Mono", ui-monospace, monospace'],
      ["--adm-min-width", "1024px"],
      ["--adm-rail-width", "232px"],
    ]) {
      expect(light, name).toContain(`${name}: ${value};`);
    }
  });

  it("test_313_tokens_hold_the_prototype_dark_values", () => {
    const css = tokens();
    const dark = css.slice(
      css.indexOf("@media (prefers-color-scheme: dark)", css.indexOf("--adm-bg")),
    );
    for (const [name, value] of [
      ["--adm-bg", "#121615"],
      ["--adm-panel", "#1a1f1e"],
      ["--adm-ink", "#e4e9e6"],
      ["--adm-accent", "#5fc0a3"],
    ]) {
      expect(dark, name).toContain(`${name}: ${value};`);
    }
  });

  it("test_313_the_admin_is_desktop_only_with_no_phone_rules", () => {
    const css = adminCss();
    expect(css).toMatch(/\.admin-shell \{[^}]*min-width: var\(--adm-min-width\)/);
    expect(css).not.toMatch(/@media \(min-width/);
    expect(css).not.toMatch(/@media \(max-width/);
    expect(css).not.toContain("var(--target)");
    // The app's 44 px tap size is switched off inside the admin only.
    expect(css).toMatch(
      /\.admin-shell :where\([^)]*button[^)]*\)\s*\{[^}]*min-height: 0;[^}]*min-width: 0;/,
    );
  });

  it("test_313_shell_parts_use_the_admin_tokens", () => {
    const css = adminCss();
    expect(block(css, ".admin-rail")).toContain("background: var(--adm-panel)");
    expect(block(css, ".admin-menu-link")).toContain("padding: var(--adm-menu-pad)");
    expect(block(css, ".admin-menu-link[aria-current]")).toContain(
      "background: var(--adm-accent-soft)",
    );
    expect(block(css, ".admin-main h1")).toContain("font-size: var(--adm-title-size)");
    expect(css).toContain(".admin-pill-published");
    expect(css).toContain(".admin-chip");
    expect(css).toContain(".admin-crumb");
    expect(css).toContain(".admin-table");
  });

  it("test_313_admin_ui_exports_breadcrumb_pill_and_chip", () => {
    const ui = read("src/app/admin/admin-ui.tsx");
    for (const name of [
      "export function Breadcrumb",
      "export function StatePill",
      "export function KeyChip",
    ]) {
      expect(ui).toContain(name);
    }
  });
});

describe("admin pages follow the prototype (#313 rows 8, 9, 11, 13, 36, 45, 48)", () => {
  const headers = (file: string) =>
    [...read(file).matchAll(/<th[^>]*>([^<{]+)<\/th>/g)].map((match) => match[1].trim());

  it("test_313_companions_is_a_table_with_the_prototype_columns", () => {
    const page = "src/app/admin/companions/page.tsx";
    expect(read(page)).toContain('className="admin-table"');
    expect(headers(page)).toEqual([
      "Character",
      "Mode",
      "Stories",
      "Shown to users",
      "Last change",
    ]);
    expect(read(page)).toContain("companionRow(");
  });

  it("test_313_app_text_is_a_table_with_the_prototype_columns", () => {
    const page = "src/app/admin/app-text/page.tsx";
    expect(read(page)).toContain('className="admin-table"');
    expect(headers(page)).toEqual(["Screen", "Key", "Text", "State"]);
    // Every function stays: draft, publish, versions and roll back.
    const editor = read("src/app/admin/app-text/app-text-editor.tsx");
    for (const text of ["Save draft", "Publish v", "Versions (", "Roll back to v", "<tr"]) {
      expect(editor).toContain(text);
    }
  });

  it("test_313_publish_history_is_a_table_with_names_and_keys", () => {
    const page = "src/app/admin/publish-history/page.tsx";
    // #447: the same admin table, with its own class for the prototype's word breaking.
    expect(read(page)).toContain('className="admin-table admin-publish-history"');
    expect(headers(page)).toEqual(["When", "Who", "What", "Version"]);
    expect(read(page)).toContain("historyItemName(");
    expect(read(page)).toContain("HistoryRowAction");
  });

  it("test_313_every_page_has_a_breadcrumb_and_no_back_link", () => {
    for (const page of [
      "src/app/admin/page.tsx",
      "src/app/admin/companions/page.tsx",
      "src/app/admin/companions/[id]/page.tsx",
      "src/app/admin/companions/[id]/stories/[story]/page.tsx",
      "src/app/admin/stories/page.tsx",
      "src/app/admin/stories/[id]/page.tsx",
      "src/app/admin/app-text/page.tsx",
      "src/app/admin/prompts/page.tsx",
      "src/app/admin/prompts/[key]/page.tsx",
      "src/app/admin/publish-history/page.tsx",
    ]) {
      expect(read(page), page).toContain("<Breadcrumb");
      expect(read(page), page).not.toContain("admin-back");
    }
  });

  it("test_313_version_states_are_coloured_pills", () => {
    for (const editor of [
      "src/app/admin/app-text/app-text-editor.tsx",
      "src/app/admin/stories/[id]/card-editor.tsx",
      "src/app/admin/companions/field-editor.tsx",
      "src/app/admin/prompts/[key]/prompt-editor.tsx",
    ]) {
      expect(read(editor), editor).toContain("<StatePill");
      expect(read(editor), editor).not.toMatch(/admin-text-state">\{STATE_LABEL/);
    }
  });
});

describe("Companions Last change reads enough history (#313 final review)", () => {
  it("test_313_last_change_asks_for_the_widest_history_window", async () => {
    const { readPublishHistory, PUBLISH_HISTORY_WIDE_LIMIT } =
      await import("@/lib/publish-history/admin");
    expect(PUBLISH_HISTORY_WIDE_LIMIT).toBe(500);
    const calls: unknown[] = [];
    await readPublishHistory(async (name, args) => {
      calls.push([name, args]);
      return { data: [], error: null };
    }, PUBLISH_HISTORY_WIDE_LIMIT);
    expect(calls).toEqual([["list_publish_history", { row_limit: 500 }]]);
    const page = read("src/app/admin/companions/page.tsx");
    expect(page).toContain("PUBLISH_HISTORY_WIDE_LIMIT");
  });

  it("test_313_a_failed_history_read_is_said_on_the_companions_page", () => {
    const page = read("src/app/admin/companions/page.tsx");
    expect(page).toMatch(/history\.ok \? null :/);
    expect(page).toContain("Last change could not be read");
  });
});
