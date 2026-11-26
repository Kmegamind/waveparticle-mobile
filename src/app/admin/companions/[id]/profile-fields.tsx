"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore, useTransition, type KeyboardEvent } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { CompanionPage, FieldEntry } from "@/lib/content-fields/pages";
import {
  changedFields,
  fieldPill,
  publishPlan,
  saveSummary,
  startText,
} from "@/lib/content-fields/profile";
import type { FieldView } from "@/lib/content-fields/view";
import type { ContentFieldWriteError, ContentFieldWriteResult } from "@/lib/content-fields/write";
import {
  publishContentFieldAction,
  rollBackContentFieldAction,
  saveContentFieldAction,
} from "../actions";
import { KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";

// #442: ADM-04 and ADM-05 of one Companion as the admin prototype draws them. The header row has
// one Save draft and one Publish; under it, tabs (Profile, Life Path) and a `dl.fields` list: one
// row per field with its label and id, its text (edited in place, as in the prototype) and its
// state pill. Each field keeps its own versions (#309): Save draft makes a new draft of every
// changed field, Publish publishes the draft of every field that has one (admin only), and each
// field's versions and Roll back stay under its text.

const PROBLEMS: Record<Exclude<ContentFieldWriteError, "checks-failed">, string> = {
  "not-allowed": "Your account cannot do this. Only an admin publishes or rolls back.",
  invalid: "This field or version is not known.",
  "unknown-item": "This Companion or story is not known, so nothing was saved. Reload the page.",
  "never-published": "This version was never published, so it cannot be rolled back to.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const checks = (count: number) => (count === 1 ? "1 check" : `${count} checks`);

const noSubscription = () => () => {};

type FieldStatus = { text: string; problems: string[] };

/** What a failed write says on its field. */
function refusal(
  result: Exclude<ContentFieldWriteResult, { ok: true }>,
  verb: string,
): FieldStatus {
  if (result.error === "checks-failed") {
    const problems = result.problems ?? [];
    return { text: `Not ${verb}: it fails ${checks(problems.length)}.`, problems };
  }
  return { text: PROBLEMS[result.error], problems: [] };
}

const attempt = (action: () => Promise<ContentFieldWriteResult>) =>
  action().catch((): ContentFieldWriteResult => ({ ok: false, error: "failed" }));

type Tab = "profile" | "life-path";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "life-path", label: "Life Path" },
];

export function ProfileFields({ page, role }: { page: CompanionPage; role: ContentRole }) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("profile");
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, FieldStatus>>({});
  const [summary, setSummary] = useState("");
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so nothing typed is lost and a click
  // never does nothing.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;
  const isAdmin = role === "admin";
  const views = [
    ...page.profile.map((entry) => entry.view),
    ...page.periods.map((p) => p.field.view),
  ];
  const unsaved = changedFields(views, typed);

  function begin() {
    setSummary("");
    setStatuses({});
  }

  function saveAll() {
    begin();
    const changes = changedFields(views, typed);
    startTransition(async () => {
      const next: Record<string, FieldStatus> = {};
      const saved: string[] = [];
      for (const change of changes) {
        const result = await attempt(() => saveContentFieldAction(change.key, change.text));
        if (result.ok) {
          saved.push(change.key);
          next[change.key] = {
            text: `${result.version ? `Draft v${result.version} saved.` : "Draft saved."} The app still shows the published text.`,
            problems: [],
          };
        } else {
          next[change.key] = refusal(result, "saved");
        }
      }
      setStatuses(next);
      setTyped((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !saved.includes(key))),
      );
      setSummary(saveSummary("save", saved.length, changes.length - saved.length));
    });
  }

  function publishAll() {
    begin();
    const plan = publishPlan(role, views, unsaved.length);
    if (!plan.ok) {
      setSummary(plan.reason);
      return;
    }
    startTransition(async () => {
      const next: Record<string, FieldStatus> = {};
      let done = 0;
      for (const draft of plan.drafts) {
        const result = await attempt(() => publishContentFieldAction(draft.key, draft.version));
        if (result.ok) {
          done += 1;
          next[draft.key] = { text: `Published v${draft.version}.`, problems: [] };
        } else {
          next[draft.key] = refusal(result, "published");
        }
      }
      setStatuses(next);
      setSummary(saveSummary("publish", done, plan.drafts.length - done));
    });
  }

  function rollBack(key: string, version: number) {
    begin();
    startTransition(async () => {
      const result = await attempt(() => rollBackContentFieldAction(key, version));
      setStatuses({
        [key]: result.ok
          ? { text: `Rolled back to v${version}.`, problems: [] }
          : refusal(result, "rolled back"),
      });
    });
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`${id}-tab-${next.id}`)?.focus();
  }

  const row = (entry: FieldEntry, extra?: React.ReactNode) => (
    <FieldRow
      busy={busy}
      entry={entry}
      extra={extra}
      isAdmin={isAdmin}
      key={entry.view.key}
      onRollBack={rollBack}
      onType={(text) => setTyped((current) => ({ ...current, [entry.view.key]: text }))}
      ready={ready}
      status={statuses[entry.view.key]}
    />
  );
  const [name, tags, who] = page.profile;
  const note = (
    <p className="admin-fields-note">
      Saving makes a new draft of each changed field; the app and the phones keep the published
      text. A text with a year, a date or an age is refused, because these fields appear on the Life
      Path. An admin publishes; every publish and roll back is in Publish history.
    </p>
  );

  return (
    <>
      <PageHead
        actions={
          <>
            <button className="button-gray" disabled={busy} onClick={saveAll} type="button">
              Save draft
            </button>
            <button
              aria-describedby={isAdmin ? undefined : `${id}-blocked`}
              className="button-filled"
              disabled={busy || !isAdmin}
              onClick={publishAll}
              type="button"
            >
              Publish
            </button>
          </>
        }
        lede={
          <>
            {page.mode === "fictional" ? "Fictional" : "Historical"} · <KeyChip>{page.key}</KeyChip>{" "}
            · each field has its own id and its own state.
          </>
        }
        title={page.name}
      />
      {isAdmin ? null : (
        <p className="admin-fields-status" id={`${id}-blocked`}>
          Only an admin can publish. Ask an admin to publish the drafts.
        </p>
      )}
      <p aria-live="polite" className="admin-fields-status" role="status">
        {summary}
      </p>

      <div aria-label="Companion fields" className="admin-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            aria-controls={`${id}-panel-${item.id}`}
            aria-selected={tab === item.id}
            className="admin-tab"
            id={`${id}-tab-${item.id}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            onKeyDown={onTabKey}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`${id}-tab-profile`}
        className="admin-panel"
        hidden={tab !== "profile"}
        id={`${id}-panel-profile`}
        role="tabpanel"
      >
        <dl className="admin-fields">
          {row(name)}
          {row(tags)}
          <dt>
            {page.oneLine.label}
            <br />
            <KeyChip>{page.oneLine.key}</KeyChip>
          </dt>
          <dd>
            <article aria-label={page.oneLine.key}>
              <span className="admin-field-text">{page.oneLine.text}</span>{" "}
              <StatePill state="earlier">Read only</StatePill>
              <p className="admin-field-note">
                Shown on the Companions screen. Editing it here needs a database change first.
              </p>
            </article>
          </dd>
          {row(who)}
        </dl>
        {note}
      </div>

      <div
        aria-labelledby={`${id}-tab-life-path`}
        className="admin-panel"
        hidden={tab !== "life-path"}
        id={`${id}-panel-life-path`}
        role="tabpanel"
      >
        {page.periods.length === 0 ? (
          <p className="admin-fields-note">No stories yet.</p>
        ) : (
          <dl className="admin-fields">
            {page.periods.map((period) =>
              row(
                period.field,
                <ol
                  aria-label={`Stories of period ${period.number}`}
                  className="admin-field-stories"
                >
                  {period.stories.map((story) => (
                    <li key={story.id}>
                      <span className="admin-page-id">{story.sequence}</span>{" "}
                      <Link href={`/admin/companions/${page.id}/stories/${story.id}`}>
                        {story.title}
                      </Link>
                    </li>
                  ))}
                </ol>,
              ),
            )}
          </dl>
        )}
        {note}
      </div>
    </>
  );
}

/** One `dl.fields` row: label and id, then the text edited in place, its pill and its versions. */
function FieldRow({
  entry,
  extra,
  status,
  ready,
  busy,
  isAdmin,
  onType,
  onRollBack,
}: {
  entry: FieldEntry;
  extra?: React.ReactNode;
  status?: FieldStatus;
  ready: boolean;
  busy: boolean;
  isAdmin: boolean;
  onType: (text: string) => void;
  onRollBack: (key: string, version: number) => void;
}) {
  const view: FieldView = entry.view;
  const pill = fieldPill(view);
  const start = startText(view);
  return (
    <>
      <dt>
        {entry.label}
        <br />
        <KeyChip>{view.key}</KeyChip>
      </dt>
      <dd>
        <article aria-label={view.key}>
          {/* Remounted when the stored text changes (after a save), so it shows the new start. */}
          <span
            aria-label={`Text for ${view.key}`}
            className="admin-field-text"
            contentEditable={ready}
            data-placeholder="Not written yet."
            key={`${view.draft?.version ?? 0}:${start}`}
            // The browser keeps a typed space at the end as a no-break space; it is a space.
            onInput={(event) => onType(event.currentTarget.innerText.replace(/ /g, " "))}
            // One paragraph per field: Enter does not add a line break.
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            // Pasted text arrives as plain text on one line, never as formatting.
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
              document.execCommand("insertText", false, text);
            }}
            role="textbox"
            spellCheck={false}
            suppressContentEditableWarning
          >
            {start}
          </span>{" "}
          <StatePill state={pill.state}>{pill.label}</StatePill>
          {view.draft ? (
            <p className="admin-field-note">
              The app still shows: {view.shown.trim() === "" ? "nothing yet" : view.shown}
            </p>
          ) : null}
          {status && status.problems.length > 0 ? (
            <ul aria-label="Problems" className="admin-card-problems">
              {status.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {view.versions.length > 1 ? (
            <details className="admin-text-versions">
              <summary>Versions ({view.versions.length})</summary>
              <ol>
                {view.versions.map((version) => (
                  <li key={version.version}>
                    <p>
                      <span className="admin-page-id">v{version.version}</span>{" "}
                      <StatePill state={version.state}>{STATE_LABEL[version.state]}</StatePill>
                    </p>
                    <p className="admin-text-body">{version.body}</p>
                    {version.canRollBack && isAdmin ? (
                      <button
                        className="button-gray button-small"
                        disabled={busy}
                        onClick={() => onRollBack(view.key, version.version)}
                        type="button"
                      >
                        Roll back to v{version.version}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          <p aria-live="polite" className="admin-fields-status" role="status">
            {status?.text ?? ""}
          </p>
        </article>
        {extra}
      </dd>
    </>
  );
}
