import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionRecordScreen, StoryRecordScreen } from "@/app/me/history/record-screens";

// #75 ME-REC and #94 the record of a finished Story.

const record = {
  goalTitle: "Lab report",
  firstDoneAt: "2026-11-03T15:00:00.000Z",
  minutes: 30,
  doneSteps: ["Gather what you need"],
  storyRecordHref: null,
};

describe("#75 the Session Record", () => {
  it("shows the Goal, the minutes and only the Steps marked done", () => {
    const html = renderToStaticMarkup(createElement(SessionRecordScreen, { record }));
    expect(html).toContain("Lab report");
    expect(html).toContain("30 min");
    expect(html).toMatch(/Steps you marked done/i);
    expect(html).toContain("Gather what you need");
    expect(html).not.toContain("His chapter");
    expect(html).not.toMatch(/\d+ of \d+|partial|complete|pause/i);
    expect(html).toMatch(/href="\/me"/);
  });

  it("links his chapter when the Story was finished", () => {
    const html = renderToStaticMarkup(
      createElement(SessionRecordScreen, {
        record: { ...record, storyRecordHref: "/me/history/s1/chapter" },
      }),
    );
    expect(html).toMatch(/href="\/me\/history\/s1\/chapter"[^>]*>His chapter ›</);
  });
});

describe("#94 the record of a finished Story", () => {
  const story = {
    storyTitle: "The Canyon and the Mesa",
    steps: [
      { title: "Gather", cards: ["Background.", "Later card."] },
      { title: "Write", cards: ["Second step card."] },
    ],
    closingLine: "The day ended at the mesa.",
    keyMoments: [] as string[],
  };

  it("shows his cards per Step in order and the stored closing line", () => {
    const html = renderToStaticMarkup(
      createElement(StoryRecordScreen, { record: story, backHref: "/me/history/s1" }),
    );
    expect(html).toContain("The Canyon and the Mesa");
    expect(html.indexOf("Background.")).toBeLessThan(html.indexOf("Later card."));
    expect(html.indexOf("Later card.")).toBeLessThan(html.indexOf("Second step card."));
    expect(html).toContain("The day ended at the mesa.");
    expect(html).not.toContain("Key moments");
    expect(html).toMatch(/href="\/me\/history\/s1"/);
  });

  it("test_no_merged_moments_the_record_never_lists_key_moments", () => {
    // NO-MERGED-MOMENTS (2026-11-18) covers the summary and this record page.
    const html = renderToStaticMarkup(
      createElement(StoryRecordScreen, {
        record: { ...story, keyMoments: ["I chose the mesa."] },
        backHref: "/me/history/s1",
      }),
    );
    expect(html).not.toContain("Key moments");
    expect(html).not.toContain("I chose the mesa.");
    expect(html).toContain("The day ended at the mesa.");
  });

  it("both pages show not found when there is no record", () => {
    for (const file of [
      "src/app/me/history/[session]/page.tsx",
      "src/app/me/history/[session]/chapter/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain("notFound()");
    }
  });
});
