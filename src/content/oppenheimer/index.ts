import storyData from "./stories.json";

export type StoryFact = {
  id: string;
  taskId: string;
  text: string;
};

export type KeySlice = {
  id: string;
  factIds: string[];
  keyLine: string;
  confirmed: boolean;
};

export type OppenheimerStory = {
  id: string;
  sequence: number;
  title: string;
  date: string;
  goal: string;
  facts: StoryFact[];
  forbiddenTerms: string[];
  keySlices: KeySlice[];
  provenance: {
    entry: string;
    sequence: string;
    keySlices: string;
  };
};

export const oppenheimerStories = storyData as OppenheimerStory[];
