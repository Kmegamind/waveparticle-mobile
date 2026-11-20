import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { seedContent } from "./support/seed-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
// Sign out builds a Supabase client while rendering; it is not what these tests check.
vi.mock("@/app/auth/auth-form", () => ({ SignOutButton: () => null }));
vi.mock("@/app/home-actions", () => ({ setGoalStatusAction: async () => ({ status: "failed" }) }));

const { ContinueLink, continueHref } = await import("@/app/continue-link");
const { GoalsProgress } = await import("@/app/progress-view");
const { ProtectedHome } = await import("@/app/protected-home");

// Issue #69 AC3: Continue on Home and on a Goal in Goals opens the signed-in focus page for that
// Goal. The focus page then applies the return rule (#257): the pop-up opens after 5 minutes or
// more away or after Back to step from rest, before the clock restarts.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";

describe("#69 AC3 the Continue link", () => {
  it("opens /focus for an in-progress Goal in every environment (#278)", () => {
    expect(continueHref({ id: GOAL, status: "in_progress" })).toBe(`/focus?goal=${GOAL}`);
    expect(continueHref({ id: GOAL, status: "done" })).toBeNull();
    expect(continueHref({ id: GOAL, status: "on_hold" })).toBeNull();
    expect(continueHref({ id: GOAL, status: "planned" })).toBeNull();
  });

  it("is a plain link, so the focus page loads fresh and reads this device's clock", () => {
    const html = renderToStaticMarkup(createElement(ContinueLink, { href: `/focus?goal=${GOAL}` }));
    expect(html).toBe(`<a class="continue-link" href="/focus?goal=${GOAL}">Continue</a>`);
    expect(read("src/app/continue-link.tsx")).not.toMatch(/from "next\/link"/);
  });

  it("shows on Home in the card of the Goal in progress", () => {
    // #268 replaced the Home list with the prototype's Goal card; Continue sits in that card.
    const html = renderToStaticMarkup(
      createElement(ProtectedHome, {
        companions: seedContent().companions,
        view: {
          kind: "goal",
          welcomeBack: false,
          card: {
            goalId: GOAL,
            title: "Write the report",
            companion: "Oppenheimer",
            stepLabel: "Step 1: Outline",
            line: null,
            status: "in_progress",
          },
          companions: [],
          inProgress: [{ goalId: GOAL, title: "Write the report", companion: "Oppenheimer" }],
        },
        continueHref: `/focus?goal=${GOAL}`,
      }),
    );
    expect(html).toContain("Write the report");
    expect(html).toContain(`href="/focus?goal=${GOAL}">Continue</a>`);
    expect(html.match(/>Continue</g)).toHaveLength(1);
  });

  it("shows on Goals next to an in-progress Goal", () => {
    const progress = {
      userId: "u",
      sessions: [],
      goals: [
        {
          id: GOAL,
          title: "Write the report",
          text: "",
          status: "in_progress" as const,
          steps: [],
        },
        { id: "g2", title: "Old goal", text: "", status: "done" as const, steps: [] },
      ],
    };
    const html = renderToStaticMarkup(createElement(GoalsProgress, { progress }));
    expect(html).toContain(`href="/focus?goal=${GOAL}">Continue</a>`);
    expect(html.match(/>Continue</g)).toHaveLength(1);
  });

  it("#278 no screen outside /try asks the test-build switch whether to show a link", () => {
    for (const file of [
      "src/app/page.tsx",
      "src/app/goals/page.tsx",
      "src/app/goals/[id]/page.tsx",
      "src/app/me/page.tsx",
      "src/app/companions/oppenheimer/page.tsx",
    ]) {
      expect(read(file), file).not.toContain("isPrototypeEnabled");
    }
  });
});
