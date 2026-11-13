export type GatewayCall =
  "plan_split" | "step_cards" | "stuck_story" | "rest_reply" | "return_popup";

export type LineSource = "generated" | "failed";

/**
 * Why a call failed after every attempt within the time limit (NO-BACKUP, FAIL-SCREEN):
 * `request` the provider could not be reached or answered with an error, `timeout` the time limit
 * ran out, `checks` every answer failed the parse or the line checks. No stored text is returned;
 * a screen turns this into the calm failure message with a retry button.
 */
export type GatewayFailureReason = "request" | "timeout" | "checks";

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

export type StuckStoryInput = {
  /** 1-based number of this Pause in the current Step. From 3 the snag is much harder (F1, PAUSE-3). */
  pauseNumber: number;
  facts: string;
  forbidTerms?: string[];
  /** One-way lines already shown in this run, oldest first (per-run list, US-AI-8). */
  earlierLines?: string[];
  /** The last card shown in this Step; the stuck story may not reuse its nouns. */
  lastCard?: string;
};

export type RestReplyInput = {
  userMessage: string;
  facts: string;
};

/** Why the return pop-up opens: Back from the rest conversation, or back after an absence (R1). */
export type ReturnTrigger = "rest" | "absence";

export type ReturnPopupInput = {
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

export type ModelGateway = {
  splitPlan(input: PlanSplitInput): Promise<PlanSplitResult>;
  writeStepCards(input: StepCardsInput): Promise<StepCardsResult>;
  writeStuckStory(input: StuckStoryInput): Promise<LineResult>;
  writeRestReply(input: RestReplyInput): Promise<LineResult>;
  writeReturnPopup(input: ReturnPopupInput): Promise<LineResult>;
};

export type CompanionKind =
  "step_card" | "background_card" | "stuck_story" | "rest_reply" | "return_popup";
