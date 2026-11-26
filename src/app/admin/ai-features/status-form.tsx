"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  AI_FEATURE_STATUS_LABEL,
  AI_FEATURE_STATUSES,
  type AiFeatureStatus,
} from "@/lib/ai-features/admin";
import { changeStatusAction } from "./actions";
import { WRITE_PROBLEMS } from "./sections-editor";

// #453 (part of #430 T6; AI-PAGE-STATUS): the status editor of drawing AIF-5. Admins pick one of
// the four statuses, may give a one-line reason and press Save status; the server action and the
// database function both refuse anyone else. A writer sees the same form, disabled (the drawing's
// "View as writer").

const noSubscription = () => () => {};

export function StatusForm({
  slug,
  status,
  readOnly,
}: {
  slug: string;
  status: AiFeatureStatus;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<AiFeatureStatus>(status);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const off = readOnly || !ready;

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const result = await changeStatusAction(slug, chosen, note).catch(
            () => ({ ok: false, error: "failed" }) as const,
          );
          if (!result.ok) {
            setMessage(WRITE_PROBLEMS[result.error]);
            return;
          }
          setNote("");
          setMessage("Status saved.");
          router.refresh();
        });
      }}
    >
      <div aria-label="Status" className="admin-seg" role="group">
        {AI_FEATURE_STATUSES.map((value) => (
          <button
            aria-pressed={chosen === value}
            className="button-gray"
            disabled={off}
            key={value}
            onClick={() => setChosen(value)}
            type="button"
          >
            {AI_FEATURE_STATUS_LABEL[value]}
          </button>
        ))}
      </div>
      <label>
        Reason (one line)
        <input
          className="admin-text-field"
          disabled={off}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why the status changes"
          type="text"
          value={note}
        />
      </label>
      <div>
        <button className="button-filled" disabled={off || pending} type="submit">
          Save status
        </button>
      </div>
      {message ? (
        <p className="admin-toast" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
