import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { TryHome } from "./try-home";

export const instant = false;

// Every Oppenheimer story can be played on the test path (#254); the page chooses one.
export default function TryPage() {
  return <TryPageContent />;
}

// The stories are read from the story content when the page is requested (#284).
async function TryPageContent() {
  await connection();
  return <TryHome stories={storyProfiles(await getStoryContent())} />;
}
