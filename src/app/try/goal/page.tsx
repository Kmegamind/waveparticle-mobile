import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { GoalDialogue } from "./goal-dialogue";

export const instant = false;

export default function TryGoalPage() {
  return <TryGoalPageContent />;
}

// The stories are read from the story content when the page is requested (#284).
async function TryGoalPageContent() {
  await connection();
  return <GoalDialogue stories={storyProfiles(await getStoryContent())} />;
}
