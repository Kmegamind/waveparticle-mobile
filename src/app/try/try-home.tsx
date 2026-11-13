"use client";

import Link from "next/link";
import { usePrototypeState } from "./use-prototype-state";

export function TryHome({ storyTitle }: { storyTitle: string }) {
  const { ready, state, reset } = usePrototypeState();

  return (
    <main className="app-screen try-screen" data-ready={ready ? "true" : "false"}>
      <h1>Oppenheimer</h1>
      <p className="try-caption">Story: {storyTitle}</p>
      {state.goal ? (
        <>
          <section aria-label="Goal" className="try-card">
            <p>{state.goal.text}</p>
          </section>
          <Link className="button-filled" href="/try/focus">
            Continue
          </Link>
          <Link className="try-link" href="/try/goal">
            Start a new Goal
          </Link>
        </>
      ) : (
        <>
          <p>No Goal yet.</p>
          <Link className="button-filled" href="/try/goal">
            Begin
          </Link>
        </>
      )}
      <button className="button-gray button-small" onClick={reset} type="button">
        Reset test data
      </button>
    </main>
  );
}
