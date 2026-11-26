"use client";

import { useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { publishChangesMessage, type AppTextChange } from "@/lib/app-text/admin";
import { KeyChip } from "../admin-ui";
import { publishAppTextChangesAction } from "./actions";

const noSubscription = () => () => {};

const plural = (count: number) => (count === 1 ? "1 draft" : `${count} drafts`);

/**
 * #445: the prototype's "Publish changes" in the header (admin only). It names its count; the
 * dialog lists each key and version it will publish, and publishes them through the per-key
 * publish. Text typed on the page but not saved as a draft is not part of it.
 */
export function PublishChanges({ changes }: { changes: AppTextChange[] }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  // The list as it was when the dialog opened: exactly what Publish sends.
  const [listed, setListed] = useState<AppTextChange[]>([]);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  function open() {
    setListed(changes);
    setStatus("");
    setDone(false);
    dialog.current?.showModal();
  }

  function publish() {
    setStatus("");
    startTransition(async () => {
      const answer = await publishAppTextChangesAction(
        listed.map(({ key, version }) => ({ key, version })),
      ).catch(() => ({ ok: false, error: "failed" }) as const);
      if (answer.ok) {
        setStatus(publishChangesMessage(answer.results));
        setDone(true);
      } else {
        setStatus(
          answer.error === "not-allowed"
            ? "Only an admin can publish changes."
            : "Could not publish the changes. Please try again.",
        );
      }
    });
  }

  return (
    <>
      <button
        className="button-filled"
        disabled={!ready || changes.length === 0}
        onClick={open}
        type="button"
      >
        Publish changes ({changes.length})
      </button>
      <dialog aria-labelledby={`${id}-title`} className="admin-sheet" ref={dialog}>
        <div className="admin-sheet-head">
          <h2 id={`${id}-title`}>Publish changes</h2>
          <button
            className="button-gray button-small"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="admin-sheet-body">
          {done ? null : (
            <p className="admin-sheet-note">
              Publishing makes{" "}
              {listed.length === 1 ? "this draft" : `these ${listed.length} drafts`} the text the
              app shows. Text typed on this page but not saved as a draft is not included.
            </p>
          )}
          <ul aria-label="Drafts to publish" className="admin-sheet-list">
            {listed.map((change) => (
              <li key={change.key}>
                <KeyChip>{change.key}</KeyChip>{" "}
                <span className="admin-page-id">v{change.version}</span>
                <p className="admin-text-body">{change.body}</p>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="admin-sheet-note" role="status">
            {status}
          </p>
        </div>
        <div className="admin-sheet-foot">
          <button className="button-gray" onClick={() => dialog.current?.close()} type="button">
            {done ? "Close" : "Cancel"}
          </button>
          {done ? null : (
            <button
              className="button-filled"
              disabled={pending || listed.length === 0}
              onClick={publish}
              type="button"
            >
              Publish {plural(listed.length)}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
