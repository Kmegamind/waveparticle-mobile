import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HomeView } from "@/lib/home/home-view";
import { seedContent } from "./support/seed-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/home-actions", () => ({ setGoalStatusAction: async () => ({ status: "failed" }) }));

const { ProtectedHome } = await import("@/app/protected-home");

// #268: the Home states of prototype v4, rendered from a HomeView.

const read = (file: string) =>
  readFileSync(path.join(path.resolve(import.meta.dirname, ".."), file), "utf8");

const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const FOCUS = `/focus?goal=${GOAL}`;

const goalView: HomeView = {
  kind: "goal",
  welcomeBack: false,
  card: {
    goalId: GOAL,
    title: "Methods section for Friday",
    companion: "Oppenheimer",
    stepLabel: "Step 1: Gather what you need",
    line: "Born’s method only works when the particles are slow.",
    status: "in_progress",
  },
  companions: ["oppenheimer"],
  inProgress: [{ goalId: GOAL, title: "Methods section for Friday", companion: "Oppenheimer" }],
};

const noneView: HomeView = {
  kind: "none",
  carriedLine: "I still carry the doubt about the canyon.",
  replay: [
    { goalId: "a", title: "Read chapter four" },
    { goalId: "b", title: "Methods section" },
  ],
  companions: ["oppenheimer"],
};

const render = (view: HomeView, continueHref: string | null = FOCUS) =>
  renderToStaticMarkup(
    createElement(ProtectedHome, { companions: seedContent().companions, view, continueHref }),
  );

describe("#268 AC2 HOME-0", () => {
  it("HOME-0 shows one card and nothing else", () => {
    const html = render({ kind: "first" }, null);
    expect(html).toContain("Let’s launch your first wave.");
    expect(html).toMatch(/href="\/companions"[^>]*>Choose a Companion</);
    expect(html).not.toContain("At your desk");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/Quick Replay|My Companions|In progress/i);
  });
});

describe("#268 AC3 HOME-1", () => {
  it("HOME-1 shows the Goal card", () => {
    const html = render(goalView);
    expect(html).toContain("At your desk");
    expect(html).toMatch(/Goal · with Oppenheimer/);
    expect(html).toContain("Methods section for Friday");
    expect(html).toContain("Where you left it");
    expect(html).toContain("Step 1: Gather what you need");
    expect(html).toMatch(/class="focus-slip[^"]*"[\s\S]*Born’s method/);
    expect(html.match(/>Continue</g)).toHaveLength(1);
    expect(html).toContain(`href="${FOCUS.replace("?", "?")}"`);
    expect(html).toMatch(/href="\/goal"[^>]*>Start something else</);
    expect(html).toMatch(/aria-label="Goal options"/);
    expect(html).toContain("My Companions");
    expect(html).toContain("In progress");
  });

  it("HOME-1 has no slip before he has shown a card", () => {
    const html = render({ ...goalView, card: { ...goalView.card, line: null } });
    expect(html).not.toContain("focus-slip");
  });

  it("#278 HOME-1 always links Start something else to the goal dialogue", () => {
    const html = render(goalView);
    expect(html).toMatch(/href="\/goal"[^>]*>Start something else</);
    expect(html).toContain(`href="${FOCUS}">Continue<`);
    expect(read("src/app/protected-home.tsx")).not.toContain("sessionPagesEnabled");
  });
});

describe("#268 AC5 AC6 HOME-NONE", () => {
  it("HOME-NONE shows the trace", () => {
    const html = render(noneView, null);
    expect(html).toContain('alt="Oppenheimer"');
    expect(html).toContain("I still carry the doubt about the canyon.");
    expect(html).toMatch(/href="\/goal"[^>]*>New session</);
    expect(html).toContain("Quick Replay");
    expect(html).toMatch(/href="\/goal"[^>]*>Read chapter four</);
    expect(html).not.toMatch(/welcome back/i);
  });

  it("HOME-NONE leaves out empty parts", () => {
    const html = render({ ...noneView, carriedLine: null, replay: [] }, null);
    expect(html).not.toContain("Quick Replay");
    expect(html).not.toContain("focus-slip");
  });
});

describe("#268 AC1 no counts or sample data", () => {
  it("Home never shows counts or sample data", () => {
    for (const html of [render({ kind: "first" }, null), render(goalView), render(noneView)]) {
      expect(html).not.toMatch(/\d+%|\d+ of \d+|days ago|away for|streak|all caught up/i);
      expect(html).not.toMatch(/No Companions yet/i);
    }
  });
});

describe("#278 HOME-NONE links always show", () => {
  it("New session and every Quick Replay chip open the goal dialogue", () => {
    const html = render(noneView, null);
    expect(html).toMatch(/href="\/goal"[^>]*>New session</);
    expect(html).toMatch(/href="\/goal"[^>]*>Read chapter four</);
    expect(html).toMatch(/href="\/goal"[^>]*>Methods section</);
  });
});
