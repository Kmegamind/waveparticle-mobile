"use client";

import { useEffect } from "react";
import { logEvent } from "@/lib/logging/server-log";
import {
  asCopy,
  helpLineStorage,
  consumeHelpLineReset,
  readHelpLineCopy,
  removeHelpLineCopy,
  setKnownSession,
  writeHelpLineCopy,
} from "@/lib/safety/help-lines";

/** How long the refresh waits; a timeout keeps the copy as it is. */
const TIMEOUT_MS = 10_000;

/**
 * Refreshes the copy of the account's help line on the phone (#118, SAFETY-REGION-STORE) once per
 * page load, so S1 shows the chosen country's entry even offline. The copy belongs to one account.
 * Only these count as signed out, and remove the copy: an explicit `{ signedIn: false }`, a
 * redirect to the sign-in page, or a different user id (that user's copy is then written). A
 * server error (any 5xx), a timeout, a network failure, or a 200 that is not JSON and not a
 * sign-in redirect keeps the copy unchanged; the last is logged. Nothing here blocks a page.
 */
export function HelpLineSync() {
  useEffect(() => {
    let live = true;
    // A new session from /auth/callback: the old copy goes before anything else.
    consumeHelpLineReset(helpLineStorage());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const signedOut = () => {
      removeHelpLineCopy(helpLineStorage());
      setKnownSession(null);
    };
    const unexpected = (event: string, status: number) =>
      logEvent("safety", { event, status }, { level: "warn" });
    fetch("/me/help-line", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!live) return;
        if (response.redirected) {
          const to = new URL(response.url, window.location.href).pathname;
          if (to === "/auth/sign-in" || to.startsWith("/auth/sign-in/")) return signedOut();
          return unexpected("help_line_unexpected_redirect", response.status);
        }
        // A server error (or any answer that is not a success) keeps the copy unchanged.
        if (!response.ok) return;
        if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
          return unexpected("help_line_not_json", response.status);
        }
        const body = (await response.json().catch(() => null)) as {
          signedIn?: unknown;
          userId?: unknown;
          ok?: unknown;
          copy?: unknown;
        } | null;
        if (!live) return;
        if (!body) return unexpected("help_line_not_json", response.status);
        if (body.signedIn === false) return signedOut();
        // The server could not read the account: the copy and the session stay as they are.
        if (body.signedIn !== true || typeof body.userId !== "string") return;
        const storage = helpLineStorage();
        const held = readHelpLineCopy(storage);
        if (held && held.userId !== body.userId) removeHelpLineCopy(storage);
        if (body.ok === true) {
          const copy = asCopy(body.copy);
          if (copy && copy.userId === body.userId) writeHelpLineCopy(storage, copy);
        }
        setKnownSession(body.userId);
      })
      .catch(() => {
        // Offline, a timeout, or the server did not answer: the phone keeps its copy.
      })
      .finally(() => clearTimeout(timer));
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return null;
}

/**
 * On the sign-in pages (/auth): after a sign out, an account deletion or before a sign-in, the
 * copy goes, so the next account never sees the last one's country (review of #406, I-1).
 */
export function HelpLineClear() {
  useEffect(() => {
    consumeHelpLineReset(helpLineStorage());
    removeHelpLineCopy(helpLineStorage());
    setKnownSession(null);
  }, []);
  return null;
}
