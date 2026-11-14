"use client";

import { useCallback } from "react";
import { pickStory } from "@/lib/prototype/story-ids";
import { SESSION_KEY } from "@/lib/prototype/session";
import type { StoryProfile } from "@/lib/prototype/story-inputs";
import { FocusBody, NoPlan, type FocusPlan } from "../../_session/focus-body";
import { TRY_PATHS } from "../../_session/paths";
import { usePrototypeState } from "../use-prototype-state";
import { loadReturnLine, loadStepCards } from "./actions";

/** /try/focus: the shared focus page (#257) with the browser store and labelled test data. */
export function FocusScreen({ stories }: { stories: StoryProfile[] }) {
  const { ready, state, update } = usePrototypeState();
  // #254: "My goal" is the chosen story's goal sentence (chapter 8 when none was chosen).
  const story = pickStory(stories, state.storyId);
  const onStepChange = useCallback(
    (currentStep: number) => update({ ...state, currentStep }),
    [state, update],
  );

  if (!ready) {
    return <main className="app-screen try-screen" data-ready="false" />;
  }
  if (state.goal === null || state.steps.length === 0) {
    return <NoPlan paths={TRY_PATHS} text="There is no Goal to work on yet." />;
  }
  const plan: FocusPlan = { goal: state.goal, steps: state.steps, storyId: state.storyId };
  return (
    <FocusBody
      host={{
        paths: TRY_PATHS,
        storageKey: SESSION_KEY,
        goalLine: story.goalShort,
        plan,
        loadStepCards,
        loadReturnLine,
        onStepChange,
      }}
    />
  );
}
