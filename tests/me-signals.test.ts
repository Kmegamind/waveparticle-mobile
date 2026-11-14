import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/me/actions", () => ({
  saveDisplayNameAction: async () => ({ status: "failed" }),
  setKeepClockRunningAction: async () => ({ status: "failed" }),
}));

const { SignalsScreen, lockScreenAfterPermission } = await import(
  "@/app/me/signals/signals-screen"
);

// #74 (and #71's setting): the Signals sub-page of prototype v4.

describe("#74 SIG", () => {
  it("has four rows with their defaults and no Listen row", () => {
    const html = renderToStaticMarkup(createElement(SignalsScreen, { keepClockRunning: false }));
    expect(html).toContain("Nothing is sent unless you turn it on.");
    for (const title of [
      "Time-up signal",
      "New-card signal",
      "Lock-screen notification",
      "Keep the clock running when I leave",
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain("One light vibration at 00:00, on phones that support it.");
    expect(html).toContain("Shows the Step name on the lock screen once you turn it on.");
    expect(html.match(/role="switch"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/Listen/);
  });

  it("the clock row shows the account's setting", () => {
    const html = renderToStaticMarkup(createElement(SignalsScreen, { keepClockRunning: true }));
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
  });

  it("the lock-screen notification turns on only when the browser allows it", () => {
    expect(lockScreenAfterPermission("granted")).toEqual({ on: true, reason: null });
    expect(lockScreenAfterPermission("denied")).toEqual({
      on: false,
      reason: "Notifications are blocked for this site.",
    });
    expect(lockScreenAfterPermission("default")).toEqual({ on: false, reason: null });
    expect(lockScreenAfterPermission("unsupported")).toEqual({
      on: false,
      reason: "This browser cannot show notifications.",
    });
  });

  it("is a child page of Me with a way back", () => {
    expect(readFileSync("src/app/me/signals/page.tsx", "utf8")).toMatch(/href="\/me"/);
  });
});
