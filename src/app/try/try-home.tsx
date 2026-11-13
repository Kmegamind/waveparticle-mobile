"use client";

import Link from "next/link";
import type { StoryProfile } from "@/lib/prototype/story-inputs";
import { pickStory } from "@/lib/prototype/story-ids";
import { usePrototypeState } from "./use-prototype-state";

/**
 * The test path's start page. Any of the 26 Oppenheimer stories can be chosen (#254); the goal
 * sentence and "Who I am" shown here come from that story's inputs.
 */
export function TryHome({ stories }: { stories: StoryProfile[] }) {
  const { ready, state, update, reset } = usePrototypeState();
  const story = pickStory(stories, state.storyId);
  const chosenId = story.id;

  return (
    <main className="app-screen try-screen" data-ready={ready ? "true" : "false"}>
      <h1>Oppenheimer</h1>
      {state.goal ? (
        <p className="try-caption">Story: {story.title}</p>
      ) : (
        <label className="try-caption">
          Chapter
          <select
            onChange={(event) => update({ ...state, storyId: event.target.value })}
            value={chosenId}
          >
            {stories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="try-goal-sentence">{story.goalShort}</p>
      <details className="try-who">
        <summary>Who I am</summary>
        <p>{story.who}</p>
      </details>
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
