import { screenState, type AccountProgress } from "@/lib/progress/account-progress";

export function GoalsProgress({ progress }: { progress: AccountProgress }) {
  if (progress.goals.length === 0) return null;

  return (
    <ul>
      {progress.goals.map((goal) => (
        <li key={goal.id}>
          {goal.title}
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
