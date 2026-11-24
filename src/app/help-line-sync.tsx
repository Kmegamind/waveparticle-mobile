"use client";

import { useEffect } from "react";
import {
  asCopy,
  helpLineStorage,
  removeHelpLineCopy,
  writeHelpLineCopy,
} from "@/lib/safety/help-lines";

/**
 * Refreshes the copy of the account's help line on the phone (#118, SAFETY-REGION-STORE) once per
 * page load, so S1 shows the chosen country's entry even offline. Signed out, the copy goes. A
 * failed read keeps the copy the phone has; nothing here ever blocks a page.
 */
export function HelpLineSync() {
  useEffect(() => {
    let live = true;
    fetch("/me/help-line", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (!live || typeof body !== "object" || body === null) return;
        const answer = body as { signedIn?: unknown; ok?: unknown; copy?: unknown };
        const storage = helpLineStorage();
        if (answer.signedIn === false) return removeHelpLineCopy(storage);
        const copy = asCopy(answer.copy);
        if (answer.ok === true && copy) writeHelpLineCopy(storage, copy);
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
