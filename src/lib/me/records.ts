import { oppenheimerStories } from "@/content/oppenheimer";
import { storyProfile } from "@/lib/prototype/story-inputs";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { doneSteps, historyEntry } from "./me-view";

/**
 * ME-REC (#75) and the record of a finished Story (#94), read from the account and never
 * regenerated. ME-REC shows only Steps marked done and never his closing line; the Story record
 * shows the cards he showed, the closing line stored at the end, and the merged key moments.
 */

export type SessionRecordView = {
  goalTitle: string;
  firstDoneAt: string;
  minutes: number;
  doneSteps: string[];
  /** "His chapter ›" for a finished Story; null until the session is completed. */
  storyRecordHref: string | null;
};

export function sessionRecord(
  progress: AccountProgress,
  sessionId: string,
): SessionRecordView | null {
  const session = progress.sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  const entry = historyEntry(progress, session);
  if (!entry) return null;
  return {
    goalTitle: entry.goalTitle,
    firstDoneAt: entry.firstDoneAt,
    minutes: entry.minutes,
    doneSteps: doneSteps(progress, session).map((step) => step.title),
    storyRecordHref:
      session.state === "completed"
        ? `/me/history/${encodeURIComponent(session.id)}/chapter`
        : null,
  };
}

export type StoryRecordView = {
  storyTitle: string;
  steps: { title: string; cards: string[] }[];
  closingLine: string | null;
  keyMoments: string[];
};

const CARD_KINDS = new Set(["background", "story_card"]);

export function storyRecord(progress: AccountProgress, sessionId: string): StoryRecordView | null {
  const session = progress.sessions.find((item) => item.id === sessionId);
  if (!session || session.state !== "completed") return null;
  const goal = progress.goals.find((item) => item.id === session.goalId);
  const story = oppenheimerStories.find((item) => item.id === session.storyId);
  if (!goal || !story) return null;
  const steps = [...session.steps]
    .sort((left, right) => left.position - right.position)
    .map((sessionStep) => ({
      title: goal.steps.find((step) => step.id === sessionStep.stepId)?.title ?? "",
      cards: session.lines
        .filter((line) => line.sessionStepId === sessionStep.id && CARD_KINDS.has(line.kind))
        .sort((left, right) => left.seq - right.seq)
        .map((line) => line.text),
    }));
  return {
    storyTitle: storyProfile(story.id).title,
    steps,
    closingLine: session.closingLine,
    keyMoments: session.mergedKeyMoments
      .map((index) => story.keySlices[index]?.keyLine)
      .filter((text): text is string => typeof text === "string"),
  };
}
