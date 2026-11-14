import { storyProfiles } from "@/lib/prototype/story-inputs";
import { GoalDialogue } from "./goal-dialogue";

export default function TryGoalPage() {
  return <GoalDialogue stories={storyProfiles()} />;
}
