import { connection } from "next/server";
import { getStoryContent } from "@/lib/content/repository";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { FocusScreen } from "./focus-screen";

export const instant = false;

// /try/focus: the focus page of the sign-in-free test path. `?speed=60` is a test-only speed-up
// in which one minute of a Step lasts one second; it is read in the browser (docs/api/prototype-session.md).
export default function TryFocusPage() {
  return <TryFocusPageContent />;
}

// The stories are read from the story content when the page is requested (#284).
async function TryFocusPageContent() {
  await connection();
  return <FocusScreen stories={storyProfiles(await getStoryContent())} />;
}
