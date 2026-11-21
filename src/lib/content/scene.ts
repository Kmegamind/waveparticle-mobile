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

/** Every person the given Stories name (each Story's `people` and `present`), each once. */
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
 * Whitlow") counts too, unless `titled` is false (the live pause message, where only known people
 * count; fix round 1 of #374).
 */
export function unseenPeople(
  text: string,
  scene: SceneCheck,
  options: { titled?: boolean } = {},
): string[] {
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
  if (options.titled === false) return found;
  for (const match of text.matchAll(TITLED)) {
    const name = match[2];
    const titled = match[1].replace(/\s+/g, " ");
    if (!allows(name) && !scene.people.includes(name) && !found.includes(titled)) {
      found.push(titled);
    }
  }
  return found;
}

/**
 * The later words a text uses (#65 AC1): each entry as a whole word, or a whole phrase when it
 * has several words, always with its exact capitals (owner decision of 2026-11-21 on #374). So
 * "lost" does not match "Los Alamos" and "mesa" does not match "Mesa". The data holds no ordinary
 * words such as "Time" or "May"; those entries were removed by the same decision.
 */
export function laterWordHits(text: string, laterWords: string[]): string[] {
  return laterWords.filter((word) => {
    const entry = word.trim();
    if (!entry) return false;
    const phrase = escape(entry).replace(/\s+/g, "\\s+");
    return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "u").test(text);
  });
}
