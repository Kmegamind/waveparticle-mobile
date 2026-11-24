"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  applyPrefs,
  DEFAULT_PREFS,
  readPrefs,
  writePrefs,
  type Appearance,
  type Prefs,
  deviceStorage,
} from "@/lib/me/prefs";
import {
  displayNameReducer,
  initialDisplayName,
  type SaveOutcome,
} from "@/lib/me/display-name-edit";
import type { MeView } from "@/lib/me/me-view";
import {
  countryName,
  helpLineStorage,
  writeHelpLineCopy,
  type HelpLineCopy,
} from "@/lib/safety/help-lines";
import { SignOutButton } from "../auth/auth-form";
import { ContinueLink } from "../continue-link";
import { saveDisplayNameAction } from "./actions";
import { HistoryPanel } from "./history-panel";
import { useShowCrisis } from "./me-safety-gate";

/**
 * ME (#81, #83, #74) as in prototype v4: the account, the Goal in progress, on-hold Goals,
 * Appearance, Plain text, History (ME-CAL, #82), Signals, Country (#118) and Sign out. At most five settings show.
 */

const NO_HELP_LINE = {
  ok: false,
  profileOk: true,
  copy: { userId: "", country: null, entry: null },
};

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();

const sinceDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function usePrefs(): [Prefs, (next: Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    // Device settings are read after hydration so the server HTML stays the same everywhere.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(readPrefs(deviceStorage()));
  }, []);
  function update(next: Prefs) {
    setPrefs(next);
    writePrefs(deviceStorage(), next);
    applyPrefs(document.documentElement, next);
  }
  return [prefs, update];
}

function DisplayName({ initial }: { initial: string }) {
  // The edit state is a pure reducer (#398): one Save at a time, Cancel drops a pending answer,
  // and each Save clears the last announcement.
  const [state, dispatch] = useReducer(displayNameReducer, initial, initialDisplayName);
  const { name, draft, editing, pending, error, announce, crisisShown, errorShown } = state;
  const editButton = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);
  /** The Save waiting for its answer, set at once so a second press sends nothing. */
  const inFlight = useRef<number | null>(null);
  const crisisHandled = useRef(0);
  const showCrisis = useShowCrisis();

  useEffect(() => {
    // Leaving edit mode (saved or Cancel) returns focus to Edit (US-GM-7).
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  useEffect(() => {
    // #392: the server's safety check flagged the name. Nothing was saved, the field is already
    // empty, and S1 shows; Back returns here in edit mode and focuses the field.
    if (crisisShown === crisisHandled.current) return;
    crisisHandled.current = crisisShown;
    showCrisis(() => field.current?.focus());
  }, [crisisShown, showCrisis]);

  useEffect(() => {
    // #400: Save keeps focus while pending (aria-disabled). If focus was lost anyway, after an
    // invalid or failed save it returns to the field, unless the person moved it elsewhere.
    if (errorShown === 0) return;
    const active = document.activeElement;
    if (!active || active === document.body) field.current?.focus();
  }, [errorShown]);

  async function save() {
    if (inFlight.current !== null || pending !== null) return;
    const request = state.nextRequest;
    inFlight.current = request;
    dispatch({ type: "save" });
    const outcome: SaveOutcome = await saveDisplayNameAction({ name: draft }).catch(() => ({
      status: "failed" as const,
    }));
    if (inFlight.current === request) inFlight.current = null;
    dispatch({ type: "answer", request, outcome });
  }

  return (
    <div className="me-name">
      {editing ? (
        <div className="me-name-edit">
          <label className="focus-label" htmlFor="me-display-name">
            Display name
          </label>
          <input
            autoFocus
            autoComplete="nickname"
            className="me-field"
            id="me-display-name"
            onChange={(event) => dispatch({ type: "type", text: event.target.value })}
            readOnly={pending !== null}
            ref={field}
            value={draft}
          />
          {error ? <p role="alert">{error}</p> : null}
          <div className="me-name-actions">
            <button
              aria-busy={pending !== null}
              // aria-disabled, not disabled: a disabled button drops keyboard focus (#400). A press
              // while pending does nothing (the guard in save()).
              aria-disabled={pending !== null}
              className="button-filled button-small"
              onClick={() => void save()}
              type="button"
            >
              {pending !== null ? "Saving…" : "Save changes"}
            </button>
            <button
              className="button-gray button-small"
              onClick={() => {
                // The server may still finish this Save: a late "ok" updates the saved name, any
                // other late answer is ignored, so a crisis no longer opens S1 (#398).
                inFlight.current = null;
                dispatch({ type: "cancel" });
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="me-name-show">
          <p className="me-name-text">{name}</p>
          <button
            className="me-text-button"
            onClick={() => dispatch({ type: "edit" })}
            ref={editButton}
            type="button"
          >
            Edit
          </button>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

function Disclosure({
  label,
  children,
  id,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="me-row me-disclosure">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="me-row-button"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {label}
        <span aria-hidden="true" className="me-caret">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div className="me-disclosure-body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function MeScreen({
  name,
  email,
  since,
  view,
  continueHref,
  helpLine = NO_HELP_LINE,
}: {
  /** The account's help line (#118); `ok` false when the entry could not be read. */
  helpLine?: { ok: boolean; profileOk: boolean; copy: HelpLineCopy };
  name: string;
  email: string;
  since: string;
  view: MeView;
  /** From #69's `continueHref`; null when the Goal cannot be continued in this build. */
  continueHref: string | null;
}) {
  const [prefs, setPrefs] = usePrefs();
  const router = useRouter();

  useEffect(() => {
    // #118 (SAFETY-REGION-STORE): Me read the account, so the phone copy is refreshed here too.
    if (helpLine.ok) writeHelpLineCopy(helpLineStorage(), helpLine.copy);
  }, [helpLine]);

  function setAppearance(appearance: Appearance) {
    setPrefs({ ...prefs, appearance });
  }

  return (
    <>
      <section aria-label="Account" className="me-account">
        <span aria-hidden="true" className="me-avatar">
          {initials(name)}
        </span>
        <div className="me-account-text">
          <DisplayName initial={name} />
          <p className="me-email">{email}</p>
          <p className="me-since">{`Since ${sinceDate(since)}`}</p>
        </div>
      </section>

      {view.current ? (
        <section aria-labelledby="me-current" className="home-card me-current">
          <h2 className="focus-label" id="me-current">
            Current goal
          </h2>
          <p className="me-current-title">{view.current.title}</p>
          <p className="me-current-companion">{view.current.companion}</p>
          {continueHref ? <ContinueLink href={continueHref} /> : null}
        </section>
      ) : null}

      {view.onHold.length > 0 ? (
        <Disclosure id="me-on-hold" label="On hold">
          <ul className="me-hold-list">
            {view.onHold.map((goal) => (
              <li key={goal.goalId}>{goal.title}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      <div className="me-row me-setting">
        <span id="me-appearance">Appearance</span>
        <div aria-labelledby="me-appearance" className="me-segmented" role="group">
          {(
            [
              ["day", "Day"],
              ["night", "Night"],
              ["system", "System"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={prefs.appearance === value}
              className="me-segment"
              key={value}
              onClick={() => setAppearance(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="me-row me-setting">
        <span id="me-plain-text">Plain text</span>
        <button
          aria-checked={prefs.plainText}
          aria-labelledby="me-plain-text"
          className="me-toggle"
          onClick={() => setPrefs({ ...prefs, plainText: !prefs.plainText })}
          role="switch"
          type="button"
        >
          {prefs.plainText ? "On" : "Off"}
        </button>
      </div>

      <Disclosure id="me-history" label="History">
        <HistoryPanel history={view.history} />
      </Disclosure>

      <Link className="me-row me-row-button" href="/me/signals">
        Signals
        <span aria-hidden="true" className="me-caret">
          ›
        </span>
      </Link>

      <p className="me-quiet">Nothing is sent unless you turn it on.</p>

      <Link className="me-row me-row-button" href="/me/country">
        <span className="me-row-label">
          Country
          <span className="me-row-value">
            {!helpLine.profileOk
              ? "Couldn’t load. Try again."
              : helpLine.copy.country
                ? countryName(helpLine.copy.country)
                : "Not chosen"}
          </span>
        </span>
        <span aria-hidden="true" className="me-caret">
          ›
        </span>
      </Link>
      {helpLine.profileOk ? null : (
        <p className="me-quiet" role="alert">
          Your country could not be read.{" "}
          <button className="me-text-button" onClick={() => router.refresh()} type="button">
            Retry
          </button>
        </p>
      )}

      <Link className="me-row me-row-button" href="/me/about">
        About the stories
        <span aria-hidden="true" className="me-caret">
          ›
        </span>
      </Link>

      <Link className="me-row me-row-button" href="/me/data">
        Data
        <span aria-hidden="true" className="me-caret">
          ›
        </span>
      </Link>

      <div className="me-signout">
        <SignOutButton />
      </div>
    </>
  );
}
