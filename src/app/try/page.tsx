import { loadTestStory } from "@/lib/prototype/test-story";
import { TryHome } from "./try-home";

export default function TryPage() {
  const story = loadTestStory();
  return <TryHome storyTitle={story.title} />;
}
