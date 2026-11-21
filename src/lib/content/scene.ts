/**
 * A Story's one scene table (SCENE-PER-STORY, #64, #65): the `scene` of its stage 0 inputs
 * (`docs/demo/<story>.stage0.json`, imported into `story_inputs.stage_zero`). There are no weather
 * or light scales. The table is used as drafted; reading it is not a gate (PUBLISH-FIRST).
 * Server code only.
 */
export type SceneTable = {
  /** The people present. */
  present: string[];
  /** The names a line may use (CONTENT_MODEL 2.11). */
  allowedWords: string[];
  /** The objects that exist. */
  props: string[];
  /** The one prop offered to the pause message. */
  pauseProp: string;
  /** Words a line may not use yet. */
  laterWords: string[];
};

/** What the card check needs: the names this Story allows, and the people the Companion knows. */
export type SceneCheck = { allowed: string[]; people: string[] };

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;

/** The Story's scene table, or null when its stage 0 inputs have none or it is not well formed. */
export function sceneTableOf(stageZero: Row | null | undefined): SceneTable | null {
  const scene = stageZero?.scene;
  if (!isRow(scene)) return null;
  const present = strings(scene.present);
  const allowedWords = strings(scene.allowedWords);
  const props = strings(scene.props);
  const laterWords = strings(scene.laterWords);
  const pauseProp = scene.pauseProp;
  if (!present || !allowedWords || !props || !laterWords || typeof pauseProp !== "string") {
    return null;
  }
  return { present, allowedWords, props, pauseProp, laterWords };
}

/** Every person a Companion's Stories name (each Story's `people` and `present`), each once. */
export function companionPeople(stageZeros: Iterable<Row | null | undefined>): string[] {
  const found = new Set<string>();
  for (const stageZero of stageZeros) {
    const people = stageZero?.people;
    if (isRow(people)) for (const name of Object.keys(people)) found.add(name);
    for (const name of sceneTableOf(stageZero)?.present ?? []) found.add(name);
  }
  return [...found];
}

/** The card check for one Story; null when it has no readable scene table. */
export function sceneCheckOf(
  stageZero: Row | null | undefined,
  people: string[],
): SceneCheck | null {
  const scene = sceneTableOf(stageZero);
  if (!scene) return null;
  return { allowed: [...new Set([...scene.present, ...scene.allowedWords])], people };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const named = (text: string, name: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${escape(name).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(text);

/** A title before a capitalised name: someone is named even when no Story lists him. */
const TITLED =
  /(?<![\p{L}\p{N}])((?:Mr|Mrs|Miss|Dr|Doctor|Professor|General|Colonel|Captain|Major|Senator|President|Admiral|Judge)\.?\s+(\p{Lu}[\p{L}'’-]+))/gu;

/**
 * The people a text names who are not in the Story's scene table (#64 AC2), in order. A known
 * person counts as named when the full name appears with the same capitals; a name is allowed when
 * it, or each of its capitalised words, is in the table. A title with an unlisted name ("Doctor
 * Whitlow") counts too.
 */
export function unseenPeople(text: string, scene: SceneCheck): string[] {
  const allowed = new Set(scene.allowed);
  const allows = (name: string) =>
    allowed.has(name) ||
    name
      .split(/\s+/)
      .filter((word) => /^\p{Lu}/u.test(word))
      .every((word) => allowed.has(word));
  const found: string[] = [];
  for (const person of scene.people) {
    if (named(text, person) && !allows(person) && !found.includes(person)) found.push(person);
  }
  for (const match of text.matchAll(TITLED)) {
    const name = match[2];
    if (!allows(name) && !scene.people.includes(name) && !found.includes(match[1])) {
      found.push(match[1].replace(/\s+/g, " "));
    }
  }
  return found;
}

/**
 * Capitalised words inside a sentence that the scene table does not allow (a person or place the
 * live line adds; AI_03 section A4, "only names.allowed"). The first word of a sentence and "I"
 * are skipped. Used on the live pause message, where a failing line is generated again.
 */
export function unlistedNames(text: string, scene: Pick<SceneTable, "present" | "allowedWords">) {
  const allowed = new Set([...scene.present, ...scene.allowedWords]);
  const found: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const rest = sentence.replace(/^[^\p{L}]*[\p{L}'’-]+/u, "");
    for (const match of rest.matchAll(/(?<![\p{L}'’])\p{Lu}\p{Ll}[\p{L}'’-]*/gu)) {
      if (!allowed.has(match[0]) && !found.includes(match[0])) found.push(match[0]);
    }
  }
  return found;
}
