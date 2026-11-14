/**
 * The Companions of Release 1 shown on Home and the Companions list (#268, #93). Only Oppenheimer
 * and Moriarty are in scope (OTHER-COMPANIONS); only Oppenheimer has stories, so only his card
 * leads anywhere. Tags and lines are prototype v4's drafts (READ-STATUS: written).
 */
export type CompanionId = "oppenheimer" | "moriarty";

export type Companion = {
  id: CompanionId;
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

export const COMPANIONS: Companion[] = [
  {
    id: "oppenheimer",
    name: "J. Robert Oppenheimer",
    shortName: "Oppenheimer",
    tags: "Brilliant · Eloquent · Haunted",
    line: "I can give you the answer. Whether you should have asked it is your problem, not the equation’s.",
    portrait: "/companions/oppenheimer.png",
    enterHref: "/companions/oppenheimer",
  },
  {
    id: "moriarty",
    name: "Professor Moriarty",
    shortName: "Moriarty",
    tags: "Analytical · Enigmatic · Defiant",
    line: "The only way to defeat the devil is to become one yourself.",
    portrait: "/companions/moriarty.png",
    enterHref: null,
  },
];

/** The Companion with this id; sessions stored before companions existed read as Oppenheimer. */
export function companionById(id: string): Companion {
  return COMPANIONS.find((companion) => companion.id === id) ?? COMPANIONS[0];
}
