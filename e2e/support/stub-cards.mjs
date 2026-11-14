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
export function stubAnswer(prompt) {
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
  if (prompt.startsWith('Return JSON only: {"story"')) {
    return JSON.stringify({ story: "I am held up by a jammed latch on my case." });
  }
  if (prompt.startsWith('Return JSON only: {"reply"')) {
    return JSON.stringify({ reply: "I keep my pencil moving across my notes." });
  }
  return JSON.stringify({ returnLine: "I kept my notes in order while the room stayed quiet." });
}
