import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LifePathView } from "@/lib/summary/life-path";

const { LifePathList } = await import("@/app/companions/oppenheimer/life-path-list");
const { scrollToCurrent } = await import("@/app/companions/oppenheimer/open-on-current");

// Issue #272 (#96 AC3 to AC5, #97 AC2 and AC4): the Life Path rows, by shape and by name.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const view: LifePathView = {
  currentId: "site-search",
  periods: [
    {
      name: "His youth",
      rows: [
        {
          id: "a",
          title: "A Memory Title",
          state: "memory",
          line: "I wanted one real paper.",
          recordHref: null,
        },
        {
          id: "b",
          title: "A Finished Title",
          state: "finished",
          line: "I sent it off.",
          recordHref: "/me/history/run-b/chapter?from=life-path",
        },
      ],
    },
    {
      name: "The Manhattan Project years",
      rows: [
        {
          id: "site-search",
          title: "The Canyon and the Mesa",
          state: "current",
          line: "I must choose.",
          recordHref: null,
        },
        { id: "c", title: "A Later Title", state: "later", line: null, recordHref: null },
      ],
    },
  ],
};

const html = renderToStaticMarkup(createElement(LifePathList, { view }));
const rowOf = (id: string) => {
  const match = html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>[\\s\\S]*?</li>`));
  if (!match) throw new Error(`no row ${id}`);
  return match[0];
};

describe("#272 AC5 (#97 AC4) every row is named for screen readers", () => {
  it("names finished, memory and current rows by state and title", () => {
    expect(rowOf("b")).toContain('<span class="sr-only">Finished: </span>');
    expect(rowOf("a")).toContain('<span class="sr-only">His memory: </span>');
    expect(rowOf("site-search")).toContain('<span class="sr-only">Current story: </span>');
  });

  it("carries each state by a shape, not by colour alone", () => {
    for (const state of ["finished", "memory", "current", "later"]) {
      expect(html).toContain(`life-node life-node-${state}`);
    }
  });
});

describe("#94 AC1 a finished row opens the record of that Story", () => {
  it("test_94_ac1_the_finished_row_is_one_link_to_its_record", () => {
    const row = rowOf("b");
    const links = row.match(/<a [^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href="/me/history/run-b/chapter?from=life-path"');
    // The link keeps the row's screen-reader name and title.
    expect(row).toMatch(/<a [^>]*>[\s\S]*Finished: [\s\S]*A Finished Title[\s\S]*<\/a>/);
  });

  it("test_94_ac1_the_record_opened_from_the_life_path_goes_back_to_it", () => {
    const page = read("src/app/me/history/[session]/chapter/page.tsx");
    expect(page).toContain('"life-path"');
    // #521: the Life Path of the session's own Companion (/companions/oppenheimer for his).
    expect(page).toContain("companionHref(record.companionId)");
  });

  it("test_94_ac4_memory_and_current_rows_do_not_open_a_record", () => {
    expect(rowOf("a")).not.toContain("/chapter");
    expect(rowOf("site-search")).not.toContain("/chapter");
  });
});

describe("#97 AC1 a finished row carries an arrow", () => {
  it("test_97_ac1_the_finished_row_shows_a_hidden_arrow_inside_its_link", () => {
    const row = rowOf("b");
    expect(row).toMatch(
      /<a [^>]*>[\s\S]*<span aria-hidden="true" class="life-arrow">›<\/span><\/a>/,
    );
    // The arrow is decoration: the name stays "Finished: <title>".
  });

  it("test_97_ac1_memory_current_and_later_rows_have_no_arrow", () => {
    for (const id of ["a", "site-search", "c"]) expect(rowOf(id)).not.toContain("life-arrow");
  });
});

describe("#97 AC5 no lock", () => {
  it("test_97_ac5_no_row_shows_a_lock", () => {
    expect(html).not.toMatch(/lock|coming soon/i);
    expect(html).not.toMatch(/<svg/i);
  });
});

describe("#272 AC2 (#96 AC4) later rows", () => {
  it('say "Later, not available" and hide the title from screen readers', () => {
    const row = rowOf("c");
    expect(row).toContain('<span class="sr-only">Later, not available</span>');
    expect(row).toMatch(/<h3 aria-hidden="true"[^>]*>A Later Title<\/h3>/);
  });

  it("are not a link and cannot be focused", () => {
    const row = rowOf("c");
    expect(row).not.toMatch(/<a |<button|tabindex/i);
  });
});

describe("#272 AC4 (#97 AC2) memory rows", () => {
  it("show one italic line and are not tappable", () => {
    const row = rowOf("a");
    expect(row).toContain('class="life-line life-memory"');
    expect(row).toContain("I wanted one real paper.");
    expect(row).not.toMatch(/<a |<button/i);
  });
});

describe("#272 AC3 (#96 AC5) the page opens on the current Story card", () => {
  it("marks the current card", () => {
    expect(rowOf("site-search")).toContain('id="current-story"');
  });

  it("scrolls it into view", () => {
    const scrollIntoView = vi.fn();
    scrollToCurrent({
      getElementById: (id: string) => (id === "current-story" ? { scrollIntoView } : null),
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(() => scrollToCurrent({ getElementById: () => null })).not.toThrow();
  });

  it("is used by the page, which only loads the data", () => {
    // #521: /companions/oppenheimer and /companions/<id> both render the one Life Path screen.
    expect(read("src/app/companions/oppenheimer/page.tsx")).toContain("<LifePathScreen");
    const page = read("src/app/companions/life-path-screen.tsx");
    expect(page).toContain("<LifePathList");
    expect(page).toContain("<OpenOnCurrent");
  });
});

describe("#272 PERIODS no dates or ages", () => {
  it("shows the period names and no year or age", () => {
    expect(html).toContain("His youth");
    expect(html).not.toMatch(/\b1[89]\d\d\b|\bage\b/i);
  });
});

describe("#278 Begin always shows on the current story", () => {
  it("links Begin to the goal dialogue, with no test-build caption", () => {
    expect(rowOf("site-search")).toMatch(/href="\/goal"[^>]*>Begin</);
    expect(html).not.toContain("test builds only");
  });
});

describe("#101 AC3 hand-drawn marks are hidden and never carry the only meaning", () => {
  it("test_101_ac3_every_mark_on_the_rows_is_aria_hidden_and_a_name_is_beside_it", () => {
    // Every node and arrow is aria-hidden; each row's state is also said in words.
    const nodes = html.match(/<span[^>]*class="life-node [^"]*"[^>]*>/g) ?? [];
    expect(nodes).toHaveLength(4);
    for (const node of nodes) expect(node).toContain('aria-hidden="true"');
    for (const arrow of html.match(/<span[^>]*class="life-arrow"[^>]*>/g) ?? []) {
      expect(arrow).toContain('aria-hidden="true"');
    }
    for (const id of ["a", "b", "site-search", "c"]) {
      expect(rowOf(id)).toMatch(
        /class="sr-only">(His memory: |Finished: |Current story: |Later, not available)</,
      );
    }
  });
});

describe("#101 AC5 CPAGE reads period, then rows in path order, then the current card", () => {
  it("test_101_ac5_cpage_reading_order", () => {
    const at = (text: string) => html.indexOf(text);
    const order = [
      at("His youth"),
      at("A Memory Title"),
      at("A Finished Title"),
      at("The Manhattan Project years"),
      at("The Canyon and the Mesa"),
      at("I must choose."),
      at("Begin"),
      at("Later, not available"),
    ];
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
});
