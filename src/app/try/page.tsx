import { storyProfiles } from "@/lib/prototype/story-inputs";
import { TryHome } from "./try-home";

// Every Oppenheimer story can be played on the test path (#254); the page chooses one.
export default function TryPage() {
  return <TryHome stories={storyProfiles()} />;
}
