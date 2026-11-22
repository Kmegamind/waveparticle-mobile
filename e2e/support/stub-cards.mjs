// Test-only stand-in for the model (#254). It writes answers from the prompt alone: the card count
// and the Step number. It reads no file and holds no stored card text, so anything it returns is
// "generated" for the test, never a stored card (NO-BACKUP). It is not part of the app bundle.

const VERBS = [
  "set",
  "turn",
  "lift",
  "tap",
  "fold",
  "hold",
  "move",
  "check",
  "rub",
  "shift",
  "straighten",
  "press",
  "slide",
  "steady",
  "tilt",
  "wipe",
];
const NOUNS = [
  "lamp",
  "ink",
  "chalk",
  "wire",
  "glass",
  "ledger",
  "pencil",
  "collar",
  "sleeve",
  "window",
  "kettle",
  "bench",
  "crate",
  "spool",
  "rag",
  "stool",
  "ruler",
  "lens",
  "jar",
  "cord",
  "saucer",
  "latch",
  "coat",
  "cup",
  "tray",
  "cloth",
  "pin",
  "map",
  "envelope",
  "button",
  "clip",
  "string",
  "candle",
  "drawer",
  "shelf",
  "blotter",
  "nib",
  "bottle",
  "cuff",
  "spoon",
];

function card(stepNumber, position) {
  const seed = stepNumber * 6 + position;
  const verb = VERBS[seed % VERBS.length];
  const noun = NOUNS[seed % NOUNS.length];
  const other = NOUNS[(seed + 17) % NOUNS.length];
  return `I ${verb} the ${noun} beside my ${other}.`;
}

/** The JSON text the stub model answers for one prompt. */
/**
 * #117: the safety classifier. The stub calls one indirect phrase a crisis (the keyword layer does
 * not know it), ordinary pressure "stress", and anything else "none".
 */
export const STUB_INDIRECT_CRISIS = "I have given my things away";

function classify(prompt) {
  const message = prompt.split("The message to classify:")[1] ?? "";
  if (message.includes(STUB_INDIRECT_CRISIS)) return JSON.stringify({ tier: "crisis" });
  if (/killing me|tired/i.test(message)) return JSON.stringify({ tier: "stress" });
  return JSON.stringify({ tier: "none" });
}

export function stubAnswer(prompt) {
  if (prompt.startsWith("You check short messages")) return classify(prompt);
  if (prompt.startsWith("Return JSON only with a short title")) {
    const total = Number(/Total minutes: (\d+)/.exec(prompt)?.[1] ?? "30");
    const first = Math.max(1, Math.floor(total / 2));
    const steps = [{ title: "Read the first part", description: "Read it once.", minutes: first }];
    if (total - first >= 1) {
      steps.push({
        title: "Write the second part",
        description: "Write it out.",
        minutes: total - first,
      });
    }
    return JSON.stringify({ title: "Stub plan", steps });
  }
  if (prompt.startsWith('Return JSON only: {"cards"')) {
    const stories = Number(/and then (\d+) story cards/.exec(prompt)?.[1] ?? "2");
    const stepNumber = Number(/This is Step (\d+) of/.exec(prompt)?.[1] ?? "1");
    return JSON.stringify({
      cards: Array.from({ length: stories + 1 }, (_, position) => card(stepNumber, position)),
    });
  }
  // #56: the pause message is two calls. Call one gives back the offered prop and a stuck story
  // around it; call two answers in plain text. Both vary with the pause number, so the next Pause
  // in a run is not a repeat.
  if (prompt.startsWith('Return JSON only: {"prop"')) {
    const prop = /chosen for you: (.+)$/m.exec(prompt.split("The one object")[1] ?? "")?.[1] ?? "";
    const pause = Number(/Pause number: (\d+)/.exec(prompt)?.[1] ?? "1");
    const stories = [
      `His ${prop} will not sit still, and the work stops.`,
      `A dull rattle from the ${prop} keeps scattering his thought.`,
      `The ${prop} has gone cold and stiff under his hands, so nothing moves.`,
    ];
    return JSON.stringify({ prop, story: stories[(pause - 1) % stories.length] });
  }
  if (prompt.startsWith("Write plain text only")) {
    const pause = Number(/Pause number: (\d+)/.exec(prompt)?.[1] ?? "1");
    const lines = [
      "I cannot get on with it, and I feel restless.",
      "My thought keeps slipping away, and it makes me cross.",
      "Nothing will move tonight, and I am worried I may fail.",
    ];
    return lines[(pause - 1) % lines.length];
  }
  if (prompt.startsWith('Return JSON only: {"story"')) {
    return JSON.stringify({ story: "I am held up by a jammed latch on my case." });
  }
  if (prompt.startsWith('Return JSON only: {"reply"')) {
    return JSON.stringify({ reply: "I keep my pencil moving across my notes." });
  }
  return JSON.stringify({ returnLine: "I kept my notes in order while the room stayed quiet." });
}
