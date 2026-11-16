import type { KeySlice, StoryFact, StoryFacts } from "../content/types";

export type PlanStep = {
  minutes: number;
};

export type StoryStepShare = {
  index: number;
  minutes: number;
  factIds: string[];
  endingKeySliceId: string | null;
  mustUseKeySliceIds: string[];
  continuesTo: "next-step" | "summary";
};

export type MergedKeyMoment = {
  id: string;
  keyLine: string;
};

export type StoryStart = {
  storyId: string;
  stepCount: number;
  instruction: string;
  facts: StoryFact[];
  mustUseKeySlices: KeySlice[];
  steps: StoryStepShare[];
  hasNextStepCards: boolean;
  mergedKeyMoments: MergedKeyMoment[];
};

type LocatedKey = {
  slice: KeySlice;
  start: number;
  end: number;
};

type Stretch = {
  from: number;
  to: number;
  endingKeySliceId: string | null;
};

/** Builds the story brief for Start. No model is called. */
export function startStory(story: StoryFacts, plan: PlanStep[]): StoryStart {
  if (plan.length < 1) {
    throw new RangeError("A plan needs at least one step");
  }
  for (const step of plan) {
    if (!Number.isInteger(step.minutes) || step.minutes < 1) {
      throw new RangeError("Each step needs a positive whole number of minutes");
    }
  }
  if (story.facts.length < 1) {
    throw new RangeError("A story needs at least one fact");
  }

  const keys = locateKeys(story);
  const stepCount = plan.length;
  const segments = divideFacts(story.facts.length, keys, stepCount);
  const mergedKeyMoments =
    stepCount < keys.length
      ? keys.slice(stepCount - 1).map((key) => ({
          id: key.slice.id,
          keyLine: key.slice.keyLine,
        }))
      : [];

  const steps: StoryStepShare[] = segments.map((segment, index) => {
    const factIds =
      segment.to < segment.from
        ? []
        : story.facts.slice(segment.from, segment.to + 1).map((fact) => fact.id);
    const mustUseKeySliceIds = keys
      .filter((key) => key.start <= segment.to && key.end >= segment.from)
      .map((key) => key.slice.id);

    return {
      index: index + 1,
      minutes: plan[index]?.minutes ?? 0,
      factIds,
      endingKeySliceId: segment.endingKeySliceId,
      mustUseKeySliceIds,
      continuesTo: index === segments.length - 1 ? "summary" : "next-step",
    };
  });

  return {
    storyId: story.id,
    stepCount,
    instruction: instructionFor(story, keys, steps, mergedKeyMoments),
    facts: story.facts,
    mustUseKeySlices: keys.map((key) => key.slice),
    steps,
    hasNextStepCards: stepCount > 1,
    mergedKeyMoments,
  };
}

function locateKeys(story: StoryFacts): LocatedKey[] {
  const indexById = new Map(story.facts.map((fact, index) => [fact.id, index]));
  const located = story.keySlices.map((slice) => {
    const indexes = slice.factIds.map((id) => {
      const index = indexById.get(id);
      if (index === undefined) {
        throw new Error(`Key slice ${slice.id} names an unknown fact ${id}`);
      }
      return index;
    });
    return {
      slice,
      start: Math.min(...indexes),
      end: Math.max(...indexes),
    };
  });
  located.sort((left, right) => left.start - right.start || left.end - right.end);
  return located;
}

function divideFacts(factCount: number, keys: LocatedKey[], stepCount: number): Stretch[] {
  if (stepCount < keys.length) {
    return fewerStepsThanKeys(factCount, keys, stepCount);
  }

  const stretches: Stretch[] = [];
  let cursor = 0;
  for (const key of keys) {
    if (key.end < cursor) {
      throw new Error(`Key slice ${key.slice.id} overlaps an earlier key slice`);
    }
    stretches.push({ from: cursor, to: key.end, endingKeySliceId: key.slice.id });
    cursor = key.end + 1;
  }

  if (cursor < factCount) {
    if (stepCount > keys.length) {
      stretches.push({ from: cursor, to: factCount - 1, endingKeySliceId: null });
    } else {
      const last = stretches.at(-1);
      if (!last) {
        throw new Error("A story with facts needs a stretch");
      }
      last.to = factCount - 1;
      last.endingKeySliceId = null;
    }
  }

  if (stretches.length === 0) {
    stretches.push({ from: 0, to: factCount - 1, endingKeySliceId: null });
  }

  return splitStretches(stretches, stepCount);
}

function fewerStepsThanKeys(factCount: number, keys: LocatedKey[], stepCount: number): Stretch[] {
  if (stepCount === 1) {
    return [{ from: 0, to: factCount - 1, endingKeySliceId: null }];
  }

  const stretches: Stretch[] = [];
  let cursor = 0;
  for (let index = 0; index < stepCount - 1; index += 1) {
    const key = keys[index];
    if (!key || key.end < cursor) {
      throw new Error("Key slices do not fall in story order");
    }
    stretches.push({ from: cursor, to: key.end, endingKeySliceId: key.slice.id });
    cursor = key.end + 1;
  }
  stretches.push({ from: cursor, to: factCount - 1, endingKeySliceId: null });
  return stretches;
}

function splitStretches(stretches: Stretch[], stepCount: number): Stretch[] {
  const parts = stretches.map(() => 1);
  let extra = stepCount - stretches.length;

  while (extra > 0) {
    let best = -1;
    let bestLength = -1;
    for (let index = 0; index < stretches.length; index += 1) {
      const stretch = stretches[index];
      if (!stretch) {
        continue;
      }
      const length = stretch.to - stretch.from + 1;
      const used = parts[index] ?? 1;
      if (used < length && length > bestLength) {
        best = index;
        bestLength = length;
      }
    }
    if (best === -1) {
      break;
    }
    parts[best] = (parts[best] ?? 1) + 1;
    extra -= 1;
  }

  const segments = stretches.flatMap((stretch, index) => {
    const length = stretch.to - stretch.from + 1;
    const sizes = evenSizes(length, parts[index] ?? 1);
    let cursor = stretch.from;
    return sizes.map((size, sizeIndex) => {
      const from = cursor;
      const to = cursor + size - 1;
      cursor = to + 1;
      return {
        from,
        to,
        endingKeySliceId: sizeIndex === sizes.length - 1 ? stretch.endingKeySliceId : null,
      };
    });
  });

  while (segments.length < stepCount) {
    segments.push({ from: 0, to: -1, endingKeySliceId: null });
  }

  return segments;
}

function evenSizes(length: number, partCount: number): number[] {
  const base = Math.floor(length / partCount);
  let remainder = length % partCount;
  const sizes: number[] = [];
  for (let index = 0; index < partCount; index += 1) {
    const bonus = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    sizes.push(base + bonus);
  }
  return sizes;
}

function instructionFor(
  story: StoryFacts,
  keys: LocatedKey[],
  steps: StoryStepShare[],
  mergedKeyMoments: MergedKeyMoment[],
): string {
  const lines = [
    `The story is divided into ${steps.length} steps.`,
    "According to the story's progress, split each step into n story cards.",
    "The key slices are facts you must use.",
    ...steps.map((step) => `Step ${step.index}: ${step.minutes} minutes.`),
    "Facts:",
    ...story.facts.map((fact) => `${fact.id}: ${fact.text}`),
    "Key slices:",
    ...keys.map((key) => `${key.slice.id}: ${key.slice.keyLine}`),
  ];

  if (mergedKeyMoments.length > 0) {
    lines.push("Summary lists every merged key moment, one line each:");
    lines.push(...mergedKeyMoments.map((moment) => `${moment.id}: ${moment.keyLine}`));
  }

  return lines.join("\n");
}
