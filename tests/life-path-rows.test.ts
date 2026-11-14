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
        { id: "a", title: "A Memory Title", state: "memory", line: "I wanted one real paper." },
        { id: "b", title: "A Finished Title", state: "finished", line: "I sent it off." },
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
        },
        { id: "c", title: "A Later Title", state: "later", line: null },
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
    const page = read("src/app/companions/oppenheimer/page.tsx");
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
