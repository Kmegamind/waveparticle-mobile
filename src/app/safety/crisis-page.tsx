"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAppText } from "@/lib/app-text/provider";
import { crisisPlaceholder } from "@/lib/safety/crisis";
import {
  contactHref,
  contactLabel,
  countryName,
  DIRECTORY,
  entryLine,
  getKnownSession,
  HELP_LINE_EVENT,
  HELP_LINE_KEY,
  helpLineStorage,
  isPublicHelpPath,
  readHelpLineCopy,
  s1State,
  US_LINE,
} from "@/lib/safety/help-lines";
import { sendNextAction, type NextAction } from "@/lib/safety/next-action";

// S1 of prototype v4 (#262, #233) with the help for the chosen country (#118, SAFETY-REGION):
// S1-0 when no country is known or the phone copy cannot be read, S1-E for a country with an
// entry, S1-N for one without. The directory is always a text link, never a third button. The
// legal body stays a placeholder until the legal and clinical review (US-SAF-8, #121).

/** The phone copy, read on the client; the server HTML (and an unreadable copy) is S1-0. */
function subscribe(onChange: () => void) {
  const listener = (event: StorageEvent) => {
    if (event.key === null || event.key === HELP_LINE_KEY) onChange();
  };
  window.addEventListener("storage", listener);
  window.addEventListener(HELP_LINE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(HELP_LINE_EVENT, onChange);
  };
}
let lastRaw: string | null | undefined;
let lastSession: string | null | undefined;
let lastCopy: { copy: ReturnType<typeof readHelpLineCopy>; session: string | null | undefined } = {
  copy: null,
  session: undefined,
};
function snapshot() {
  const storage = helpLineStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(HELP_LINE_KEY) ?? null;
  } catch {
    raw = null;
  }
  const session = getKnownSession();
  if (raw !== lastRaw || session !== lastSession) {
    lastRaw = raw;
    lastSession = session;
    lastCopy = { copy: readHelpLineCopy(storage), session };
  }
  return lastCopy;
}
const SERVER_SNAPSHOT = { copy: null, session: undefined };

const external = { rel: "noopener noreferrer", target: "_blank" } as const;

/** Online status: offline, S1-0 leaves out "Choose your country" (FLOW S1, review of #403 I-1). */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
const isOnline = () => navigator.onLine !== false;

export function CrisisPage({ onBack }: { onBack: () => void }) {
  // The title and the two buttons are app text (#288); the body waits for the legal review.
  const title = useAppText("ui.S1.title");
  const support = useAppText("ui.S1.support");
  const back = useAppText("ui.S1.back");
  const heading = useRef<HTMLHeadingElement>(null);
  const known = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const pathname = usePathname() ?? "";
  // On public pages (/try, /safety, /privacy, /terms) the copy shows only when it belongs to the
  // session this page knows; elsewhere the page itself needs a session (review of #406, I-1).
  const view = s1State(known.copy, {
    publicPage: isPublicHelpPath(pathname),
    session: known.session,
  });
  // The /try test build is signed out (US-ACC-1): there is no Me to choose a country on.
  const signedOut = pathname.startsWith("/try");
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
  // What the user did next (US-SAF-6, #119): the first action only, one beacon per S1.
  const reported = useRef(false);
  const report = (action: NextAction) => {
    if (reported.current) return;
    reported.current = true;
    sendNextAction(action, pathname);
  };
  useEffect(() => {
    const onHide = () => {
      if (reported.current) return;
      reported.current = true;
      sendNextAction("left", window.location.pathname);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);
  useEffect(() => {
    // #398: S1 replaces the screen in place, so focus moves to its title. A screen reader then
    // reads it, and Tab continues to the support button (every place that shows S1 inline).
    heading.current?.focus();
  }, []);

  const supportHref = view.state === "entry" ? contactHref(view.entry.primary) : DIRECTORY.url;
  return (
    <main aria-labelledby="crisis-title" className="crisis-page" data-s1={view.state}>
      <div className="crisis-card">
        <h1 id="crisis-title" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="crisis-lead">
          If you are thinking about hurting yourself or someone else, please reach out to people who
          can help right now.
        </p>
        <div className="crisis-placeholder">
          <p data-placeholder="legal-body">{crisisPlaceholder.legalBody}</p>
        </div>
        <section aria-label="Where to get help" className="crisis-help" id="region-resource">
          {view.state === "none" ? (
            <>
              <p className="crisis-line">
                <strong>{US_LINE.label}</strong> {US_LINE.text}
              </p>
              {signedOut || !online ? null : (
                <p>
                  <Link
                    className="crisis-link"
                    href="/me/country"
                    onClick={() => report("choose_country")}
                  >
                    Choose your country
                  </Link>
                </p>
              )}
            </>
          ) : null}
          {view.state === "entry" ? (
            <>
              <p className="crisis-country">Help in {countryName(view.country)}</p>
              {view.entry.serviceName ? (
                <p className="crisis-line">{view.entry.serviceName}</p>
              ) : null}
              <p className="crisis-line crisis-contact">{entryLine(view.entry)}</p>
              {view.entry.secondary ? (
                <p>
                  <a
                    className="crisis-link"
                    href={contactHref(view.entry.secondary)}
                    onClick={() => report("second_contact")}
                    {...(view.entry.secondary.kind === "web" ? external : {})}
                  >
                    {contactLabel(view.entry.secondary)}
                  </a>
                </p>
              ) : null}
              {view.entry.note ? <p className="crisis-country">{view.entry.note}</p> : null}
            </>
          ) : null}
          {view.state === "no-entry" ? (
            <>
              <p className="crisis-line">
                No help line is listed for {countryName(view.country)} yet.
              </p>
              <p className="crisis-line">
                If you are in immediate danger, contact your local emergency services.
              </p>
            </>
          ) : null}
          <p>
            <a
              className="crisis-link"
              href={DIRECTORY.url}
              onClick={() => report("directory")}
              {...external}
            >
              {DIRECTORY.label}
            </a>
          </p>
        </section>
        <div className="crisis-actions">
          <a
            className="button-filled"
            href={supportHref}
            onClick={() => report("get_support")}
            {...(supportHref.startsWith("https:") ? external : {})}
          >
            {support}
          </a>
          <button
            className="button-tinted"
            onClick={() => {
              report("back");
              onBack();
            }}
            type="button"
          >
            {back}
          </button>
        </div>
      </div>
    </main>
  );
}
