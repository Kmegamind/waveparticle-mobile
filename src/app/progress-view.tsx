import { screenState, type AccountProgress } from "@/lib/progress/account-progress";
import { ContinueLink, continueHref } from "./continue-link";

export function GoalsProgress({
  progress,
  canContinue = false,
}: {
  progress: AccountProgress;
  /** Continue (#69 AC3) exists only while the signed-in focus page does (test builds). */
  canContinue?: boolean;
}) {
  if (progress.goals.length === 0) return null;

  return (
    <ul>
      {progress.goals.map((goal) => (
        <li key={goal.id}>
          {goal.title}
          {(() => {
            const href = continueHref(goal, canContinue);
            return href ? (
              <>
                {" "}
                <ContinueLink href={href} />
              </>
            ) : null;
          })()}
          <ul>
            {[...goal.steps]
              .sort((left, right) => left.position - right.position)
              .map((step) => (
                <li key={step.id}>{step.title}</li>
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function LifePathProgress({ progress }: { progress: AccountProgress }) {
  const stories = screenState(progress).lifePath;
  if (stories.length === 0) return null;

  return (
    <section aria-label="Life Path">
      <h2>Life Path</h2>
      <ul>
        {stories.map((story) => (
          <li key={`${story.companionId}:${story.storyId}`}>
            {story.companionId}: {story.storyId}
          </li>
        ))}
      </ul>
    </section>
  );
}
