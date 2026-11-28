import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IntroPlayer } from "@/app/me/intro/intro-player";
import { showsTabBar } from "@/app/shell-rules";
import { INTRO_SLIDES } from "@/lib/intro/slides";

// #480 (US-GM-9 AC4): Replay intro on Me opens a short intro that can be skipped.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
vi.mock("@/app/auth/auth-form", () => ({ SignOutButton: () => null }));
vi.mock("@/app/me/actions", () => ({ saveDisplayNameAction: async () => ({ status: "failed" }) }));

const { MeScreen } = await import("@/app/me/me-screen");

const me = () =>
  renderToStaticMarkup(
    createElement(MeScreen, {
      name: "Ada",
      email: "ada@example.test",
      since: "2026-11-01T00:00:00Z",
      view: { current: null, onHold: [], history: [] },
      continueHref: null,
    }),
  );

describe("#480 Replay intro", () => {
  it("Me has a Replay intro row that opens /me/intro", () => {
    expect(me()).toMatch(/href="\/me\/intro"[^>]*>Replay intro/);
  });

  it("the intro has a few short slides in the product's words and no urgency", () => {
    expect(INTRO_SLIDES.length).toBeGreaterThanOrEqual(2);
    expect(INTRO_SLIDES.length).toBeLessThanOrEqual(4);
    const text = INTRO_SLIDES.map((slide) => `${slide.title} ${slide.body}`).join(" ");
    expect(text).toMatch(/Companion/);
    expect(text).toMatch(/Goal/);
    expect(text).toMatch(/Step/);
    expect(text).not.toMatch(/Mission|Task|!|streak/i);
  });

  it("the first slide shows Next and Skip, and Skip goes back to Me", () => {
    const html = renderToStaticMarkup(createElement(IntroPlayer));
    expect(html).toContain(INTRO_SLIDES[0].title);
    expect(html).toMatch(/Step 1 of \d/);
    expect(html).toMatch(/<button[^>]*>Next</);
    expect(html).toMatch(/href="\/me"[^>]*>Skip</);
  });

  it("the intro page hides the tab bar so the intro is the only thing on screen", () => {
    expect(showsTabBar("/me/intro")).toBe(false);
    expect(showsTabBar("/me")).toBe(true);
  });
});
