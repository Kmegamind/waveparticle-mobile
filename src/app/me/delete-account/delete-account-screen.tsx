"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "./actions";

/** ACCOUNT-DELETE as in prototype v4: one card that asks here, Keep my account first. */
export function DeleteAccountScreen() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function confirm() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const outcome = await deleteAccountAction().catch(() => ({ status: "failed" as const }));
      // On success the action opens Sign in; anything returned here is a refusal.
      setError(
        outcome.status === "signed-out"
          ? "You are signed out. Sign in again to delete your account."
          : "Could not delete your account. Nothing was removed. Please try again.",
      );
    });
  }

  return (
    <section aria-labelledby="delete-title" className="home-card delete-card">
      <h1 className="delete-title" id="delete-title">
        Delete your account
      </h1>
      <p>
        This deletes your account and the data in it: your Goals, Steps and history, and the lines
        he showed you. It cannot be undone.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="delete-actions">
        <Link className="button-filled" href="/me/data">
          Keep my account
        </Link>
        <button
          aria-disabled={pending}
          className="button-gray"
          disabled={pending}
          onClick={confirm}
          type="button"
        >
          Delete account
        </button>
      </div>
    </section>
  );
}
