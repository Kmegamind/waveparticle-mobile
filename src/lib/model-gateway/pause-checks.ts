import type { SceneTable } from "@/lib/content/scene";

/**
 * The checks that keep the stuck story of a Pause (call one, PAUSE-TWO-CALLS, #56) texture and
 * never an event (docs/ai/AI_03 section A4). Each returns rule ids; the gateway generates the
 * answer again with the matching fix from `retry_hints`.
 *
 * - `prop`: the answer's `prop` is not the offered prop, the story does not use it, or the story
 *   also names another prop of the scene table (the story uses only the offered prop, #56 AC2).
 * - `object`: the story names an object that is not in this Story's scene table: a prop of
 *   another of the Companion's Stories, or one of the common objects below.
 * - `event`: the story contains an event verb (someone arrives, says, decides, finds, loses...).
 * - `place`: the story takes him to a named place not in the scene table's names
 *   ("to Chicago", "at the Mesa").
 */

/**
 * Verbs that make something happen in his Story (AI_03 section A4), in their usual forms. Forms
 * that are often a noun or an adjective ("leaves", "broken", "call") are left out (fix round 1).
 */
const EVENT_VERBS = [
  ...["arrive", "arrives", "arrived", "arriving"],
  ...["come", "comes", "came", "coming"],
  ...["enter", "enters", "entered", "entering"],
  ...["say", "says", "said", "saying"],
  ...["tell", "tells", "told", "telling"],
  ...["ask", "asks", "asked", "asking"],
  ...["agree", "agrees", "agreed", "agreeing"],
  ...["refuse", "refuses", "refused", "refusing"],
  ...["decide", "decides", "decided", "deciding"],
  ...["announce", "announces", "announced", "announcing"],
  ...["calls", "called", "calling"],
  ...["find", "finds", "found", "finding"],
  ...["lose", "loses", "lost", "losing"],
  ...["break", "breaks", "broke", "breaking"],
  ...["win", "wins", "won", "winning"],
];

/**
 * Verbs that describe his stuck state only when ongoing ("I keep losing it", "the lead keeps
 * breaking"); said once and done ("I found the error", "I lost the argument") they are events
 * (fix round 2). "Decide" is never his stuck state unless negated ("I can't decide").
 */
const SELF_VERBS = new Set([
  ...["find", "finds", "found", "finding"],
  ...["lose", "loses", "lost", "losing"],
  ...["break", "breaks", "broke", "breaking"],
]);
const ONGOING = new Set(["keep", "keeps", "kept"]);

/** Words that may stand between "I" and his verb ("I can't find", "I keep losing"). */
const BETWEEN = new Set(
  (
    "can can't cannot could couldn't do don't did didn't have haven't had hadn't keep keeps kept " +
    "am was just still almost nearly not to seem seems seemed try tried will won't would " +
    "wouldn't simply even never always again"
  ).split(" "),
);
const NEGATIONS = new Set(
  "can't cannot couldn't don't didn't haven't hadn't won't wouldn't not never".split(" "),
);
const FIRST_PERSON = new Set(["i", "i've", "i'm", "i'd", "i'll"]);

/**
 * "lost his place", "losing the thread", "coming loose", "keep coming back to", "what to say":
 * his own stuck state or a thing's state, in either person, not an event.
 */
const STUCK_STATE =
  /\b(?:(?:lose|loses|lost|losing)\s+(?:his|my|the)\s+(?:own\s+)?(?:place|thread|track|way|train|nerve|patience|temper|grip|footing|count|balance|concentration|focus|line)|(?:come|comes|came|coming)\s+(?:loose|apart|undone|unstuck|off|away|unravelled|unraveled)|(?:keep|keeps|kept)\s+coming\s+back|(?:what|how|where)\s+to\s+(?:say|tell|ask|begin|find))\b/giu;

/**
 * Common objects that are new to any scene unless its table lists them: a telegram, a car that
 * "arrives". The props of the Companion's other Stories are added to these. Words that are often
 * not an object ("key", "letter", "map", "money") are left out (fix round 1).
 */
const COMMON_OBJECTS = [
  "telegram",
  "envelope",
  "parcel",
  "package",
  "car",
  "truck",
  "jeep",
  "bus",
  "bicycle",
  "horse",
  "boat",
  "telephone",
  "phone",
  "radio",
  "typewriter",
  "gun",
  "pistol",
  "rifle",
  "knife",
  "wallet",
  "briefcase",
  "suitcase",
  "camera",
  "newspaper",
  "photograph",
  "ticket",
  "bottle",
];

/**
 * Words that are never counted as a new object, even when a scene table lists them as a prop:
 * the ground, the air, light, body words and ordinary words that also name parts of props
 * ("long table", "front door", "stack of pages").
 */
const ORDINARY_WORDS = new Set(
  (
    "ground dust wind sky breath sunlight light wall page pages front long sheet water path " +
    "trail grass lawn lake rock rocks stairs floorboard floorboards note notes paper papers " +
    "program pack tie tree trees row rows air floor stack counter"
  ).split(" "),
);

const SMALL_WORDS = new Set(["of", "a", "an", "the", "and", "with", "on", "in"]);

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}'-]+/u)
    .map((word) => word.replace(/^'+|'+$/g, "").replace(/'s$/, ""))
    .filter(Boolean);

/** A plural and its singular count as one object ("papers", "glasses", "boxes"). */
function singular(word: string): string {
  if (/(?:ss|sh|ch|x|s)es$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the text uses the phrase as whole words, in any case, singular or plural. */
export function usesProp(text: string, prop: string): boolean {
  const words = prop.trim().split(/\s+/).filter(Boolean).map(escape);
  if (words.length === 0) return false;
  words[words.length - 1] = `${words[words.length - 1]}(?:s|es)?`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join("\\s+")}(?![\\p{L}\\p{N}])`, "iu").test(
    text.replace(/[’‘]/g, "'"),
  );
}

/** The other props of the scene that the story names (a prop inside the offered one is not one). */
export function otherProps(story: string, offered: string, props: string[]): string[] {
  const own = new Set(wordsOf(offered).map(singular));
  return props.filter(
    (prop) =>
      prop.trim().toLowerCase() !== offered.trim().toLowerCase() &&
      !wordsOf(prop).every((word) => own.has(singular(word))) &&
      usesProp(story.replace(new RegExp(escape(offered), "gi"), " "), prop),
  );
}

/**
 * `prop`: the answer gives back the offered prop, its story uses it, and it names no other prop
 * of the scene table.
 */
export function propRules(
  answerProp: unknown,
  story: string,
  offered: string,
  props: string[] = [],
): string[] {
  const given = typeof answerProp === "string" ? answerProp.trim().toLowerCase() : "";
  const same = given === offered.trim().toLowerCase();
  const only = otherProps(story, offered, props).length === 0;
  return same && usesProp(story, offered) && only ? [] : ["prop"];
}

/**
 * The objects a prop list names as whole entries: each prop as a phrase, and for a prop of several
 * words its head noun ("chair" in "witness chair", "stack" in "stack of pages") when that is not an
 * ordinary word. A modifier ("long" in "long table", "light" in "light bulb") is never an object.
 */
export function objectEntries(props: string[]): string[] {
  const entries = new Set<string>();
  for (const prop of props) {
    const words = wordsOf(prop);
    if (words.length === 0) continue;
    const phrase = words.join(" ");
    if (words.length === 1) {
      if (!ORDINARY_WORDS.has(phrase) && !ORDINARY_WORDS.has(singular(phrase))) entries.add(phrase);
      continue;
    }
    entries.add(phrase);
    const of = words.indexOf("of");
    const head = of > 0 ? words[of - 1] : words[words.length - 1];
    if (!ORDINARY_WORDS.has(head) && !ORDINARY_WORDS.has(singular(head))) entries.add(head);
  }
  return [...entries];
}

/** The objects the story names that this scene does not have (rule `object`). */
export function unlistedObjects(
  story: string,
  scene: SceneTable,
  companionProps: string[] = [],
): string[] {
  const allowed = new Set(
    [...scene.props, scene.pauseProp]
      .flatMap(wordsOf)
      .filter((word) => !SMALL_WORDS.has(word))
      .map(singular),
  );
  const sceneHas = (entry: string) =>
    wordsOf(entry)
      .filter((word) => !SMALL_WORDS.has(word))
      .every((word) => allowed.has(singular(word)) || ORDINARY_WORDS.has(word));
  const found: string[] = [];
  for (const entry of objectEntries([...COMMON_OBJECTS, ...companionProps])) {
    if (!found.includes(entry) && usesProp(story, entry) && !sceneHas(entry)) found.push(entry);
  }
  return found;
}

/**
 * The event verbs a text uses, as whole words in any case (rule `event`). His own stuck state is
 * not an event: "lost his place" in either person, and in his first-person message (call two,
 * `firstPerson`) a verb of his own state after "I" ("I can't find", "I keep losing"), or any of
 * these verbs after "I" with a negation ("I can't say why"). Someone arriving or speaking is.
 */
export function eventVerbs(text: string, options: { firstPerson?: boolean } = {}): string[] {
  const tokens = wordsOf(text.replace(STUCK_STATE, " "));
  const found: string[] = [];
  tokens.forEach((token, index) => {
    if (!EVENT_VERBS.includes(token) || found.includes(token)) return;
    if (options.firstPerson) {
      let back = index - 1;
      let negated = false;
      let ongoing = false;
      while (back >= 0 && BETWEEN.has(tokens[back]) && index - back <= 4) {
        if (NEGATIONS.has(tokens[back])) negated = true;
        if (ONGOING.has(tokens[back])) ongoing = true;
        back -= 1;
      }
      // "I keep losing it", "the lead keeps breaking": ongoing, his stuck state.
      if (SELF_VERBS.has(token) && ongoing && token.endsWith("ing")) return;
      // "I can't find the line", "I can't decide", "I don't say it well": negated, with him.
      if (back >= 0 && FIRST_PERSON.has(tokens[back]) && negated) return;
    }
    found.push(token);
  });
  return found;
}

/** "to Chicago", "at the Mesa": a capitalised name after a word of place or movement. */
const PLACE =
  /(?<![\p{L}\p{N}])(?:in|at|to|from|toward|towards|into|near|across)\s+(?:the\s+)?(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*)*)/gu;

/** The named places a story takes him to that the scene table does not name (rule `place`). */
export function unlistedPlaces(story: string, scene: SceneTable): string[] {
  const allowed = new Set([...scene.present, ...scene.allowedWords]);
  const found: string[] = [];
  for (const match of story.matchAll(PLACE)) {
    const name = match[1];
    const words = name.split(/\s+/).map((word) => word.replace(/['’]s$/, ""));
    if (!allowed.has(name) && !words.every((word) => allowed.has(word)) && !found.includes(name)) {
      found.push(name);
    }
  }
  return found;
}

/** The text with the prop's words taken out, so the last-card noun rule ignores the offered prop. */
export function withoutProp(text: string, prop: string): string {
  const words = prop.trim().split(/\s+/).filter(Boolean).map(escape);
  if (words.length === 0) return text;
  return text.replace(
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?:s|es)?(?![\\p{L}\\p{N}])`, "giu"),
    " ",
  );
}
