"use client";

import { useEffect } from "react";
import {
  asCopy,
  helpLineStorage,
  readHelpLineCopy,
  removeHelpLineCopy,
  setKnownSession,
  writeHelpLineCopy,
} from "@/lib/safety/help-lines";

/**
 * Refreshes the copy of the account's help line on the phone (#118, SAFETY-REGION-STORE) once per
 * page load, so S1 shows the chosen country's entry even offline. The copy belongs to one account:
 * - no session (or a redirect, or an answer that is not JSON): the copy goes;
 * - another user is signed in: the copy goes before anything else;
 * - a failed read of the account: the copy stays as it is;
 * - a network failure (offline): the copy stays, which is the offline promise.
 * Nothing here ever blocks a page.
 */
export function HelpLineSync() {
  useEffect(() => {
    let live = true;
    const signedOut = () => {
      removeHelpLineCopy(helpLineStorage());
      setKnownSession(null);
    };
    fetch("/me/help-line", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!live) return;
        const json = (response.headers.get("content-type") ?? "").includes("application/json");
        if (response.redirected || !response.ok || !json) return signedOut();
        const body = (await response.json().catch(() => null)) as {
          signedIn?: unknown;
          userId?: unknown;
          ok?: unknown;
          copy?: unknown;
        } | null;
        if (!live) return;
        if (!body || body.signedIn !== true) return signedOut();
        // The server could not read the account: the copy and the session stay as they are.
        if (typeof body.userId !== "string") return;
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
        // Offline or the server did not answer: the phone keeps its copy.
      });
    return () => {
      live = false;
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
    removeHelpLineCopy(helpLineStorage());
    setKnownSession(null);
  }, []);
  return null;
}
