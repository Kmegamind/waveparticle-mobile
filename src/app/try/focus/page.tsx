import { storyProfiles } from "@/lib/prototype/story-inputs";
import { FocusScreen } from "./focus-screen";

// /try/focus: the focus page of the sign-in-free test path. `?speed=60` is a test-only speed-up
// in which one minute of a Step lasts one second; it is read in the browser (docs/api/README.md).
export default function TryFocusPage() {
  return <FocusScreen stories={storyProfiles()} />;
}
