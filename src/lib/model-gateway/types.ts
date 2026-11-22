import type { PauseCategory } from "@/lib/content/pause-snag";
import type { SceneTable } from "@/lib/content/scene";

export type GatewayCall =
  | "plan_split"
  | "step_cards"
  | "stuck_story"
  | "pause_predicament"
  | "rest_reply"
  | "return_popup"
  | "closing_line";

export type LineSource = "generated" | "failed";

/**
 * Why a call failed after every attempt within the time limit (NO-BACKUP, FAIL-SCREEN):
 * `request` the provider could not be reached or answered with an error, `timeout` the time limit
 * ran out, `checks` every answer failed the parse or the line checks. No stored text is returned;
 * a screen turns this into the calm failure message with a retry button.
 */
export type GatewayFailureReason = "request" | "timeout" | "checks" | "prompt";

export type GatewayFailure = { source: "failed"; reason: GatewayFailureReason };

export type GatewayLog = {
  call: GatewayCall;
  source: LineSource;
  reason?: GatewayFailureReason;
  rejectedRules: string[];
  latencyMs: number;
  attempts: number;
};

export type ModelProvider = (input: { prompt: string; signal: AbortSignal }) => Promise<string>;

export type PlanSplitInput = {
  goal: string;
  totalMinutes: number;
  splitFiner: boolean;
};

export type PlanStep = {
  title: string;
  description: string;
  minutes: number;
};

export type GeneratedPlan = {
  source: "generated";
  title: string;
  steps: PlanStep[];
};

export type PlanSplitResult = GeneratedPlan | GatewayFailure;

/**
 * One Step's cards. No user-written text goes in (#216, US-AI-11): not the Step title, not the
 * Goal. The Story side says where this Step sits in his Story (#43).
 */
export type StepCardsInput = {
  /** The name of the Companion speaking, for the `name` check (#302). Default: Oppenheimer. */
  companionName?: string;
  minutes: number;
  /** Who he is and where, and the Story facts of earlier Steps; never a later Step's facts. */
  facts: string;
  /**
   * The Story facts of this Step only, so the prompt can say what is new (CARD-NEW). An empty
   * string means this Step has no facts of its own. Omitted: `facts` is sent as before.
   */
  stepFacts?: string;
  /** 1-based place of this Step among the Plan's Steps. */
  stepNumber?: number;
  stepCount?: number;
  /** How many story cards follow the opening card (1 to 5, T7). Default: up to 4. */
  storyCards?: number;
  /** The first card is the background card (Step 1; CARD-LENGTH allows it 70 words). */
  background?: boolean;
  /** Key lines this Step must use (US-CON-2). */
  mustUse?: string[];
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
};

export type StepCardsResult =
  | {
      source: "generated";
      cards: string[];
    }
  | GatewayFailure;

/**
 * Call one of the pause message (PAUSE-TWO-CALLS, #56): the stuck story, a short third-person
 * record of what has gone wrong in his own work, built around the category and the prop the code
 * picked (`pickPauseSnag`). It is never an event: it never moves his Story.
 */
export type StuckStoryInput = {
  /** The name of the Companion speaking, for the `name` check (#302). Default: Oppenheimer. */
  companionName?: string;
  /** 1-based number of this Pause in the current Step. From 3 the snag is much harder (F1, PAUSE-3). */
  pauseNumber: number;
  facts: string;
  /** The snag category the code picked (AI_03 section A1). */
  category?: PauseCategory;
  /** The prop the code picked from the scene table; the answer must give it back and use it. */
  prop?: string;
  /** The stuck stories of the earlier Pauses in this Step, oldest first (no repeats). */
  earlierStories?: string[];
  /**
   * Every prop the Companion's Stories name. An object among them that is not in this Story's
   * scene table fails `object`, as do the common objects listed in the checks.
   */
  companionProps?: string[];
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
  /** The last card shown in this Step; the stuck story may not reuse its nouns. */
  lastCard?: string;
  /**
   * The Story's one scene table (SCENE-PER-STORY, #64, #65): the prompt offers its pause prop and
   * lists its objects and names; the answer may name no one outside it and use none of its later
   * words.
   */
  scene?: SceneTable;
  /**
   * Every person the Companion's Stories name (`companionPeople`). With `scene`, the answer fails
   * `people` when it names one who is not in this Story's scene table, wherever in the line.
   */
  people?: string[];
};

/**
 * Call two of the pause message (PAUSE-TWO-CALLS, #56): his own words about the predicament of
 * call one's stuck story and his feelings, as plain text (not JSON). This is the message he shows:
 * 1 or 2 sentences and at most 30 words (LEN-PAUSE).
 */
export type PausePredicamentInput = {
  companionName?: string;
  pauseNumber: number;
  facts: string;
  /** The stuck story that call one returned. */
  story: string;
  /** The prop of call one; the last-card noun rule ignores it. */
  prop?: string;
  /** The stuck stories of the earlier Pauses in this Step, oldest first (he remembers them). */
  earlierStories?: string[];
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
  lastCard?: string;
  scene?: SceneTable;
  people?: string[];
};

export type StuckStoryResult =
  { source: "generated"; prop: string; story: string } | GatewayFailure;

export type RestReplyInput = {
  /** The name of the Companion speaking, for the `name` check (#302). Default: Oppenheimer. */
  companionName?: string;
  userMessage: string;
  facts: string;
  /** Words from after his date (the Story's forbidden terms); a reply that uses one is generated again. */
  forbidTerms?: string[];
  /**
   * Every message the person typed in this rest chat, the current one included. A later word that
   * the person typed himself does not fail the reply (CHAT-USER-WORD).
   */
  userTexts?: string[];
  /**
   * Facts from later in the Story: the spoiler words of the parts the person has not reached
   * (CHAT-SPOILER-CHECK, #60). Whole words, any case.
   */
  laterFacts?: string[];
  /** The Story's scene table later words (#60). Whole words with their exact capitals. */
  laterWords?: string[];
};

/** Why the return pop-up opens: Back from the rest conversation, or back after an absence (R1). */
export type ReturnTrigger = "rest" | "absence";

export type ReturnPopupInput = {
  /** The name of the Companion speaking, for the `name` check (#302). Default: Oppenheimer. */
  companionName?: string;
  trigger: ReturnTrigger;
  facts: string;
  awayMinutes: number;
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
};

export type LineResult =
  | {
      source: "generated";
      text: string;
    }
  | GatewayFailure;

/**
 * The closing call at the end of a run (#258, #41, END-TONE): what happened to him that day and
 * how he feels, plus one thing he still carries. Built from the story only, never from user text.
 */
export type ClosingLineInput = {
  /** The name of the Companion speaking, for the `name` check (#302). Default: Oppenheimer. */
  companionName?: string;
  /** Who he is, the place, the story's goal sentence and the facts of the run. */
  facts: string;
  /** The facts of the last moment of the run. */
  lastMoment: string;
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
};

export type ClosingLineResult =
  { source: "generated"; closingLine: string; carryLine: string } | GatewayFailure;

export type ModelGateway = {
  splitPlan(input: PlanSplitInput): Promise<PlanSplitResult>;
  writeStepCards(input: StepCardsInput): Promise<StepCardsResult>;
  writeStuckStory(input: StuckStoryInput): Promise<StuckStoryResult>;
  writePausePredicament(input: PausePredicamentInput): Promise<LineResult>;
  writeRestReply(input: RestReplyInput): Promise<LineResult>;
  writeReturnPopup(input: ReturnPopupInput): Promise<LineResult>;
  writeClosingLine(input: ClosingLineInput): Promise<ClosingLineResult>;
};

/** `stuck_story` is call one (third person); `pause_message` is call two, the message he shows. */
export type CompanionKind =
  | "step_card"
  | "background_card"
  | "stuck_story"
  | "pause_message"
  | "rest_reply"
  | "return_popup"
  | "closing_line";
