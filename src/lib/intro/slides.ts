/**
 * The intro (#480, US-GM-9 AC4): a few short slides on how the app works. System voice: neutral,
 * no urgency (DESIGN.md section 9). Words follow the product vocabulary (Companion, Goal, Step).
 */
export type IntroSlide = { title: string; body: string };

export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    title: "Pick one real Goal",
    body: "Say what you want to get done. It is split into Steps, each with its own time.",
  },
  {
    title: "A Companion lives a parallel story",
    body: "While you work, a Companion from history lives a story of his own, one card at a time.",
  },
  {
    title: "One Step at a time",
    body: "Stay with the current Step. The story waits for you, and you can pause whenever you need to.",
  },
];
