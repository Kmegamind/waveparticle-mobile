"use client";

import { usePrototypeState } from "./use-prototype-state";

export function TryHome({ storyTitle }: { storyTitle: string }) {
  const { ready, state, reset } = usePrototypeState();

  return (
    <main className="app-screen try-screen" data-ready={ready ? "true" : "false"}>
      <h1>Oppenheimer</h1>
      <p className="try-caption">Story: {storyTitle}</p>
      {state.goal ? (
        <section aria-label="Goal" className="try-card">
          <p>{state.goal.text}</p>
        </section>
      ) : (
        <p>No Goal yet.</p>
      )}
      <button className="button-gray button-small" onClick={reset} type="button">
        Reset test data
      </button>
    </main>
  );
}
