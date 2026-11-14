export type CardLabel = "Where I am" | "Right now" | "How I got here";

/**
 * The label inside his card on the focus page (prototype v4, #238): the background card of Step 1
 * is where he is, the newest card is right now, and older cards are how he got here.
 */
export function cardLabel(stepIndex: number, cardIndex: number, cardCount: number): CardLabel {
  if (stepIndex === 0 && cardIndex === 0) return "Where I am";
  return cardIndex === cardCount - 1 ? "Right now" : "How I got here";
}
