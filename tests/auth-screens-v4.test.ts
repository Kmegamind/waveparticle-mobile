import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

const { AuthForm } = await import("@/app/auth/auth-form");
const { isPublicPath } = await import("@/lib/supabase/session");
const { default: PrivacyPage } = await import("@/app/privacy/page");

// Issue #262 (#229 to #232): the account screens match prototype v4; behaviour is unchanged.

type Mode = "sign-in" | "sign-up" | "forgot-password" | "update-password";
const render = (mode: Mode) => renderToStaticMarkup(createElement(AuthForm, { mode }));
const link = (html: string, href: string, name: string) =>
  expect(html).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>${name}</a>`));

describe("#262 AC1 Sign in (#229)", () => {
  const html = render("sign-in");
  it("has the title, the sentence and the three centred link lines", () => {
    expect(html).toContain(">Sign in</h1>");
    expect(html).toContain("An account keeps your Goals and Steps on every device.");
    link(html, "/auth/forgot-password", "Forgot your password\\?");
    expect(html).toMatch(
      /New here\?(<\/span>)?\s*(<!-- -->)?\s*(<!-- -->)?\s*<a[^>]*href="\/auth\/sign-up"[^>]*>Create an account<\/a>/,
    );
    link(html, "/privacy", "Privacy notice");
    expect(html).toContain('class="auth-links"');
  });
});

describe("#262 AC2 Create an account (#230)", () => {
  const html = render("sign-up");
  it("has the back row to Sign in and the privacy line", () => {
    expect(html).toMatch(
      /<a[^>]*aria-label="Back to Sign in"[^>]*href="\/auth\/sign-in"|<a[^>]*href="\/auth\/sign-in"[^>]*aria-label="Back to Sign in"/,
    );
    expect(html).toContain('class="auth-back-label">Sign in</span>');
    expect(html).toContain(">Create an account</h1>");
    expect(html).toContain("What is stored and what is sent to the language model:");
    link(html, "/privacy", "Privacy notice");
  });
});

describe("#262 AC3 Forgot your password (#231)", () => {
  const html = render("forgot-password");
  it("has the prototype title, sentence, button and back row", () => {
    expect(html).toContain(">Forgot your password</h1>");
    expect(html).toContain("Enter your email. We will send a link to choose a new password.");
    expect(html).toContain(">Send link</button>");
    expect(html).toContain('aria-label="Back to Sign in"');
  });
});

describe("#262 AC4 Choose a new password (#232)", () => {
  const html = render("update-password");
  it("has the new field label and button", () => {
    // Two lines, as in the prototype: "Choose a" / "new password".
    expect(html).toMatch(
      /<h1>Choose a\s*(<!-- -->)?\s*<span class="auth-title-line">new password<\/span><\/h1>/,
    );
    expect(html).toMatch(/New password\s*(<!-- -->)?\s*<input/);
    expect(html).toContain(">Save password</button>");
  });
});

describe("#262 AC7 behaviour is unchanged", () => {
  it("keeps the same fields and their attributes", () => {
    expect(render("sign-in")).toContain('autoComplete="current-password"');
    expect(render("sign-in")).toContain('type="email"');
    expect(render("sign-up")).toContain('autoComplete="new-password"');
    expect(render("update-password")).not.toContain('type="email"');
    expect(render("forgot-password")).not.toContain('type="password"');
    expect(render("sign-up")).toContain('minLength="8"');
  });

  it("lets a signed-out visitor open the privacy placeholder", () => {
    expect(isPublicPath("/privacy", false)).toBe(true);
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("The privacy notice is not written yet.");
    expect(html).toContain('href="/auth/sign-in"');
  });
});
