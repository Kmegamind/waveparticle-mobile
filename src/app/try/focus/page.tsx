import { testStoryGoalLine } from "@/lib/prototype/focus-cards";
import { FocusScreen } from "./focus-screen";

// /try/focus: the focus page of the sign-in-free test path. `?speed=60` is a test-only speed-up
// in which one minute of a Step lasts one second; it is read in the browser (docs/api/README.md).
export default function TryFocusPage() {
  return <FocusScreen goalLine={testStoryGoalLine()} />;
}
