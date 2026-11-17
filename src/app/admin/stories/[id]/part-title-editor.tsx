"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { StoryCardWriteError } from "@/lib/story-cards/write";
import { saveStoryPartTitleAction } from "../actions";

const PROBLEMS: Record<StoryCardWriteError, string> = {
  "not-allowed": "Your account cannot rename parts.",
  invalid: "This part is not known.",
  blank: "Write a title first. An empty title is not saved.",
  "too-long": "Keep the title under 200 characters.",
  "checks-failed": "Could not save the title. Please try again.",
  failed: "Could not save the title. Please try again.",
};

const noSubscription = () => () => {};

/** A part title on ADM-06 (#304). Saved directly: no phone shows part titles, so no versions. */
export function PartTitleEditor({
  storyId,
  part,
  title,
}: {
  storyId: string;
  part: number;
  title: string | null;
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  return (
    <form
      className="admin-text-form"
      onSubmit={(event) => {
        event.preventDefault();
        const text = String(new FormData(event.currentTarget).get("title") ?? "");
        setStatus("");
        startTransition(async () => {
          const result = await saveStoryPartTitleAction(storyId, part, text).catch(
            () => ({ ok: false, error: "failed" }) as const,
          );
          setStatus(result.ok ? "Title saved." : PROBLEMS[result.error]);
        });
      }}
    >
      <label className="admin-text-label" htmlFor={`${id}-title`}>
        Title of part {part}
      </label>
      <input
        className="admin-text-field"
        defaultValue={title ?? ""}
        disabled={!ready}
        id={`${id}-title`}
        maxLength={200}
        name="title"
        type="text"
      />
      <div className="admin-text-actions">
        <button className="button-gray button-small" disabled={pending || !ready} type="submit">
          Save title
        </button>
      </div>
      <p aria-live="polite" className="admin-text-status" role="status">
        {status}
      </p>
    </form>
  );
}
