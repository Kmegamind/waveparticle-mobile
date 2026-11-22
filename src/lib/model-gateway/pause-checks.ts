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

/** Verbs that make something happen in his Story (AI_03 section A4), in their usual forms. */
const EVENT_VERBS = [
  "arrive",
  "arrives",
  "arrived",
  "arriving",
  "comes",
  "came",
  "leaves",
  "leaving",
  "enter",
  "enters",
  "entered",
  "entering",
  "say",
  "says",
  "said",
  "saying",
  "tell",
  "tells",
  "told",
  "telling",
  "ask",
  "asks",
  "asked",
  "asking",
  "agree",
  "agrees",
  "agreed",
  "agreeing",
  "refuse",
  "refuses",
  "refused",
  "refusing",
  "decide",
  "decides",
  "decided",
  "deciding",
  "announce",
  "announces",
  "announced",
  "announcing",
  "call",
  "calls",
  "called",
  "calling",
  "find",
  "finds",
  "found",
  "finding",
  "lose",
  "loses",
  "lost",
  "losing",
  "break",
  "breaks",
  "broke",
  "broken",
  "breaking",
  "win",
  "wins",
  "won",
  "winning",
];

/**
 * Common objects that are new to any scene unless its table lists them: a telegram, a car that
 * "arrives". The props of the Companion's other Stories are added to these.
 */
const COMMON_OBJECTS = [
  "telegram",
  "letter",
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
  "key",
  "wallet",
  "briefcase",
  "suitcase",
  "camera",
  "newspaper",
  "photograph",
  "ticket",
  "money",
  "bottle",
  "map",
];

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
  const known = new Set(
    [...COMMON_OBJECTS, ...companionProps.flatMap(wordsOf)]
      .filter((word) => !SMALL_WORDS.has(word))
      .map(singular),
  );
  const found: string[] = [];
  for (const word of wordsOf(story)) {
    const base = singular(word);
    if (known.has(base) && !allowed.has(base) && !found.includes(base)) found.push(base);
  }
  return found;
}

/** The event verbs a story uses, as whole words in any case (rule `event`). */
export function eventVerbs(story: string): string[] {
  const words = new Set(wordsOf(story));
  return EVENT_VERBS.filter((verb) => words.has(verb));
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
