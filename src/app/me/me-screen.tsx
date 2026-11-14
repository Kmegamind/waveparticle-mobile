"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  applyPrefs,
  DEFAULT_PREFS,
  readPrefs,
  writePrefs,
  type Appearance,
  type Prefs,
} from "@/lib/me/prefs";
import type { MeView } from "@/lib/me/me-view";
import { SignOutButton } from "../auth/auth-form";
import { ContinueLink } from "../continue-link";
import { saveDisplayNameAction } from "./actions";
import { HistoryPanel } from "./history-panel";

/**
 * ME (#81, #83, #74) as in prototype v4: the account, the Goal in progress, on-hold Goals,
 * Appearance, Plain text, History (ME-CAL, #82), Signals and Sign out. At most five settings show.
 */

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
    setPrefs(readPrefs(window.localStorage));
  }, []);
  function update(next: Prefs) {
    setPrefs(next);
    writePrefs(window.localStorage, next);
    applyPrefs(document.documentElement, next);
  }
  return [prefs, update];
}

function DisplayName({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  async function save() {
    const outcome = await saveDisplayNameAction({ name: draft }).catch(() => ({
      status: "failed" as const,
    }));
    if (outcome.status === "ok") {
      setName(outcome.name);
      setError("");
      setAnnounce("Display name saved");
      returnFocus.current = true;
      setEditing(false);
    } else {
      // The typed text stays in the field (DESIGN 8, errors in words).
      setError(
        outcome.status === "invalid"
          ? "Use 1 to 60 characters."
          : "Could not save the name. Please try again.",
      );
    }
  }

  return (
    <div className="me-name">
      {editing ? (
        <div className="me-name-edit">
          <label className="focus-label" htmlFor="me-display-name">
            Display name
          </label>
          <input
            autoComplete="nickname"
            className="me-field"
            id="me-display-name"
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          {error ? <p role="alert">{error}</p> : null}
          <div className="me-name-actions">
            <button
              className="button-filled button-small"
              onClick={() => void save()}
              type="button"
            >
              Save changes
            </button>
            <button
              className="button-gray button-small"
              onClick={() => {
                setDraft(name);
                setError("");
                returnFocus.current = true;
                setEditing(false);
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
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
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
}: {
  name: string;
  email: string;
  since: string;
  view: MeView;
  /** From #69's `continueHref`; null when the Goal cannot be continued in this build. */
  continueHref: string | null;
}) {
  const [prefs, setPrefs] = usePrefs();

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

      <div className="me-signout">
        <SignOutButton />
      </div>
    </>
  );
}
