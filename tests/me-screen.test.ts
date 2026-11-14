import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MeView } from "@/lib/me/me-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
vi.mock("@/app/auth/auth-form", () => ({
  SignOutButton: () => createElement("button", null, "Sign out"),
}));
vi.mock("@/app/me/actions", () => ({
  saveDisplayNameAction: async () => ({ status: "failed" }),
  setKeepClockRunningAction: async () => ({ status: "failed" }),
}));

const { MeScreen } = await import("@/app/me/me-screen");
const { HistoryPanel, calendarMonth } = await import("@/app/me/history-panel");

// #81, #82, #83, #74: the Me page of prototype v4.

const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";

const view: MeView = {
  current: { goalId: GOAL, title: "Methods section", companion: "Oppenheimer" },
  onHold: [{ goalId: "h", title: "Old essay" }],
  history: [
    {
      sessionId: "s2",
      goalTitle: "Lab report",
      companion: "Oppenheimer",
      firstDoneAt: "2026-11-03T15:00:00.000Z",
      minutes: 30,
    },
    {
      sessionId: "s1",
      goalTitle: "Reading",
      companion: "Oppenheimer",
      firstDoneAt: "2026-11-02T15:00:00.000Z",
      minutes: 15,
    },
  ],
};

const render = (v: MeView, continueHref: string | null = `/focus?goal=${GOAL}`) =>
  renderToStaticMarkup(
    createElement(MeScreen, {
      name: "Yue",
      email: "reviewer@example.test",
      since: "2026-11-01T10:00:00.000Z",
      view: v,
      continueHref,
    }),
  );

describe("#81 the account and the Goal", () => {
  it("shows name with Edit, email and the first-launch date", () => {
    const html = render(view);
    expect(readFileSync("src/app/me/page.tsx", "utf8")).toMatch(
      /<main className="app-screen[^"]*">\s*<h1>Me<\/h1>/,
    );
    expect(html).toContain(">YU<");
    expect(html).toContain("Yue");
    expect(html).toContain("reviewer@example.test");
    expect(html).toMatch(/Since Nov(ember)? 1, 2026/);
    expect(html).toMatch(/<button[^>]*>Edit</);
  });

  it("shows the current Goal with one Continue, and nothing when no Goal is in progress", () => {
    const html = render(view);
    expect(html).toContain("Current goal");
    expect(html).toContain("Methods section");
    expect(html.match(/>Continue</g)).toHaveLength(1);
    const none = render({ ...view, current: null }, null);
    expect(none).not.toContain("Current goal");
  });

  it("On hold is collapsed with no number, and absent when nothing is on hold", () => {
    const html = render(view);
    expect(html).toMatch(/aria-expanded="false"[^>]*>[^<]*On hold/);
    expect(html).not.toContain("Old essay");
    expect(html).not.toMatch(/On hold[^<]*\d/);
    expect(render({ ...view, onHold: [] })).not.toContain("On hold");
  });

  it("Sign out is kept", () => {
    expect(render(view)).toContain("Sign out");
  });
});

describe("#83 #74 settings on Me", () => {
  it("Appearance offers Day, Night and System; Plain text; Signals; the notifications line", () => {
    const html = render(view);
    for (const label of ["Day", "Night", "System"]) {
      expect(html).toMatch(new RegExp(`aria-pressed="(true|false)"[^>]*>${label}<`));
    }
    expect(html).toContain("Plain text");
    expect(html).toMatch(/href="\/me\/signals"/);
    expect(html).toContain("Nothing is sent unless you turn it on.");
    expect(html).not.toMatch(/Listen/);
  });

  it("History is collapsed by default", () => {
    expect(render(view)).toMatch(/aria-expanded="false"[^>]*>[^<]*History/);
  });
});

describe("#82 the history panel", () => {
  it("the calendar marks and opens only days with a session", () => {
    const month = calendarMonth(view.history, "2026-11-03T15:00:00.000Z");
    expect(month.label).toBe("November 2026");
    const marked = month.days
      .filter((day) => day && day.sessions.length > 0)
      .map((day) => day!.day);
    expect(marked).toEqual([2, 3]);
    const html = renderToStaticMarkup(createElement(HistoryPanel, { history: view.history }));
    expect(html.match(/<button[^>]*class="me-day me-day-marked"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*class="me-day"[^-]/);
    expect(html).not.toMatch(/total|streak|days? in a row|\bmissed\b/i);
  });

  it("the list shows days newest first and rows open the Session Record", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryPanel, { history: view.history, initialView: "list" }),
    );
    expect(html.indexOf("Lab report")).toBeLessThan(html.indexOf("Reading"));
    expect(html).toContain('href="/me/history/s2"');
    expect(html).toContain("30 min");
  });
});

describe("#81 final review: accessibility", () => {
  it("the calendar is a labelled group of day buttons, not an empty grid", () => {
    const html = renderToStaticMarkup(createElement(HistoryPanel, { history: view.history }));
    expect(html).not.toContain('role="grid"');
    expect(html).toMatch(
      /aria-label="November 2026"[^>]*role="group"|role="group"[^>]*aria-label="November 2026"/,
    );
  });

  it("opening Edit moves focus into the name field", () => {
    expect(readFileSync("src/app/me/me-screen.tsx", "utf8")).toMatch(/<input[\s\S]{0,80}autoFocus/);
  });
});
