import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isPublicPath } from "@/lib/supabase/session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("@/app/auth/auth-form", () => ({ SignOutButton: () => null }));
vi.mock("@/app/me/actions", () => ({ saveDisplayNameAction: async () => ({ status: "failed" }) }));

const { PrivacyNotice, PRIVACY_NOTICE_DATE } = await import("@/app/privacy/privacy-notice");
const { TermsText } = await import("@/app/terms/terms-text");
const { AboutStories } = await import("@/app/me/about/about-stories");
const { DataRows } = await import("@/app/me/data/data-rows");
const { MeScreen } = await import("@/app/me/me-screen");

// #102 (privacy notice), #104 (About these stories and the Terms), #103 (Data rows) and #8 AC3.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const link = (html: string, href: string, name: string) =>
  expect(html).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*>${name}</a>`));

describe("#102 AC1 AC3 #8 AC3 the privacy notice", () => {
  const html = renderToStaticMarkup(createElement(PrivacyNotice, { back: "sign-in" }));
  const words = text(html);

  it("is a real notice with a date, not a placeholder", () => {
    expect(PRIVACY_NOTICE_DATE).toBe("November 14, 2026");
    expect(words).toContain("Last changed: November 14, 2026");
    expect(words).not.toMatch(/placeholder|not written yet/i);
  });

  it("says what is stored on our server", () => {
    for (const thing of ["Goal", "Step", "history", "lines he showed you", "display name"]) {
      expect(words, thing).toContain(thing);
    }
    expect(words).toMatch(/rest conversation[^.]*stays? on your device/i);
  });

  it("says exactly what text is sent to the language model", () => {
    expect(words).toMatch(/Goal you write[^.]*sent to the language model/i);
    expect(words).toMatch(/each message you write in the rest conversation/i);
    expect(words).toMatch(/Nothing else you write is sent/i);
  });

  it("says the safety check sends nothing, and claims no model records that do not exist", () => {
    expect(words).toMatch(/safety check runs in our app[^.]*nothing is sent/i);
    expect(words).not.toMatch(/records about the language model|which checks a line did not pass/i);
    expect(words).toMatch(/does not keep a separate record of what is sent to the language model/i);
  });

  it("names what the sign-in and hosting services keep, and what deletion does not reach", () => {
    expect(words).toMatch(/IP address/);
    expect(words).toMatch(/Deleting your account does not remove those records/i);
  });

  it("lists every kind of thing stored for a Goal and a session", () => {
    expect(words).toMatch(/whether you asked for finer Steps/i);
    expect(words).toMatch(/when the session started, was last active and was finished/i);
    expect(words).toMatch(/background card/i);
    expect(words).toMatch(/key moments/i);
  });

  it("says earlier rest messages go with each new one, and the split choice is sent", () => {
    expect(words).toMatch(/your last few messages and his replies are sent again/i);
    expect(words).toMatch(/whether you asked for finer Steps are sent to the language model/i);
  });

  it("says retention by the provider is not decided, without inventing terms", () => {
    expect(words).toMatch(/not yet decided/i);
    expect(words).not.toMatch(/GDPR|CCPA|certified|compliant|we never share|30 days/i);
  });

  it("links to export and deletion", () => {
    link(html, "/me/export", "Export my data");
    link(html, "/me/delete-account", "Delete my data");
  });
});

describe("#102 AC2 the notice is reachable from Me and from sign-in", () => {
  it("opens without signing in, from Data and from Sign in", () => {
    expect(isPublicPath("/privacy", false)).toBe(true);
    expect(renderToStaticMarkup(createElement(DataRows))).toMatch(
      /href="\/privacy\?from=me"[^>]*>Privacy notice</,
    );
    expect(read("src/app/auth/auth-form.tsx")).toContain('href="/privacy"');
  });

  it("goes back where it came from", () => {
    const fromMe = renderToStaticMarkup(createElement(PrivacyNotice, { back: "me" }));
    expect(fromMe).toContain('href="/me/data"');
    const fromSignIn = renderToStaticMarkup(createElement(PrivacyNotice, { back: "sign-in" }));
    expect(fromSignIn).toContain('href="/auth/sign-in"');
  });
});

describe("#104 AC1 About these stories", () => {
  const html = renderToStaticMarkup(createElement(AboutStories));
  const words = text(html);

  it("carries one statement that his first-person lines are imagined", () => {
    expect(words).toMatch(/first-person lines are imagined/i);
  });

  it("#104 AC2 states that the Companion is an AI and links the Terms", () => {
    expect(words).toMatch(/written by an AI/i);
    link(html, "/terms", "Terms");
  });

  it("#104 AC3 states that WaveParticle is not a medical or crisis service", () => {
    expect(words).toMatch(/not a medical or crisis service/i);
    link(html, "/safety", "where to find help now");
  });
});

describe("#104 AC2 AC3 the Terms", () => {
  const words = text(renderToStaticMarkup(createElement(TermsText)));

  it("state that the character is an AI and the product is not a medical or crisis service", () => {
    expect(words).toMatch(/written by an AI/i);
    expect(words).toMatch(/not a medical or crisis service/i);
    expect(words).toMatch(/imagined/i);
  });

  it("open without signing in", () => {
    expect(isPublicPath("/terms", false)).toBe(true);
  });
});

describe("#103 Data under Me", () => {
  const html = renderToStaticMarkup(createElement(DataRows));

  it("lists the privacy notice, Export my data and Delete my data", () => {
    expect(html).toMatch(/href="\/privacy\?from=me"[^>]*>Privacy notice</);
    expect(html).toMatch(/href="\/me\/export"[^>]*>Export my data</);
    expect(html).toMatch(/href="\/me\/delete-account"[^>]*>Delete my data</);
  });

  it("Me shows About the stories and Data, as in prototype v4", () => {
    const me = renderToStaticMarkup(
      createElement(MeScreen, {
        name: "Ada",
        email: "ada@example.test",
        since: "2026-11-01T00:00:00Z",
        view: { current: null, onHold: [], history: [] },
        continueHref: null,
      }),
    );
    expect(me).toMatch(/href="\/me\/about"[^>]*>About the stories/);
    expect(me).toMatch(/href="\/me\/data"[^>]*>Data/);
    expect(me.indexOf("/me/signals")).toBeLessThan(me.indexOf("/me/about"));
    expect(me.indexOf("/me/about")).toBeLessThan(me.indexOf("/me/data"));
  });
});
