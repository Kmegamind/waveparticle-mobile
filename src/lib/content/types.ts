import type { SceneTable } from "./scene";

/**
 * Story content as the app holds it (#284): the Companions and their stories, read from Supabase
 * through `src/lib/content/repository.ts`. Display fields carry the names the screens use; the
 * model-only inputs sit under `inputs` and never reach the browser. No date is held here
 * (DATES-ADMIN-ONLY).
 */

export type StoryFact = {
  id: string;
  taskId: string;
  text: string;
};

export type KeySlice = {
  id: string;
  factIds: string[];
  keyLine: string;
  /** KEY-UNCONFIRMED: false until a person has reviewed the key moment. */
  confirmed: boolean;
};

/** What `startStory` needs from a story: its facts in order and its key moments. */
export type StoryFacts = {
  id: string;
  facts: StoryFact[];
  keySlices: KeySlice[];
};

/** A story record of the seed file (`src/content/oppenheimer/stories.json`). Tests and scripts only. */
export type OppenheimerStory = StoryFacts & {
  sequence: number;
  title: string;
  date: string;
  goal: string;
  forbiddenTerms: string[];
  provenance: { entry: string; sequence: string; keySlices: string };
};

export type Companion = {
  id: string;
  name: string;
  /** The name on Home's overline ("Goal · with Oppenheimer"). */
  shortName: string;
  tags: string;
  /** One line in his own voice. */
  line: string;
  /** Path under `public/`. */
  portrait: string;
  /** Where Enter goes; null while the Companion has no stories. */
  enterHref: string | null;
};

/** Model-only inputs: server side only, never sent to the browser. */
export type StoryInputs = {
  goal: string;
  facts: StoryFact[];
  forbiddenTerms: string[];
  keySlices: KeySlice[];
  /** The other stage 0 inputs (place, forbidden and later words, ...). */
  stageZero: Record<string, unknown>;
  /** The Story's one scene table (SCENE-PER-STORY); null when the inputs have none. */
  scene: SceneTable | null;
};

export type Story = {
  id: string;
  companionId: string;
  sequence: number;
  title: string;
  /** The Life Path period (a name, never a date). */
  period: string;
  /** The goal sentence ("My goal", the Life Path row line). */
  goalShort: string;
  /** The "Who I am" line. */
  who: string;
  /** The goal dialogue's first line: where he is, then the one question. */
  opening: string;
  inputs: StoryInputs;
};

export type StoryContent = {
  companions: Companion[];
  /** In Companion order, then story order. */
  stories: Story[];
};

export const storyFacts = (story: Story): StoryFacts => ({
  id: story.id,
  facts: story.inputs.facts,
  keySlices: story.inputs.keySlices,
});
