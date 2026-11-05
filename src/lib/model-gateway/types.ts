export type GatewayCall =
  "plan_split" | "step_cards" | "stuck_story" | "rest_reply" | "return_popup";

export type LineSource = "generated" | "authored";

export type GatewayLog = {
  call: GatewayCall;
  source: LineSource;
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

export type PlanSplitResult = {
  source: LineSource;
  title: string;
  steps: PlanStep[];
};

export type StepCardsInput = {
  stepTitle: string;
  minutes: number;
  facts: string;
  forbidTerms?: string[];
};

export type StepCardsResult = {
  source: LineSource;
  cards: string[];
};

export type StuckStoryInput = {
  stepTitle: string;
  facts: string;
  forbidTerms?: string[];
};

export type RestReplyInput = {
  userMessage: string;
  facts: string;
};

export type ReturnPopupInput = {
  facts: string;
  awayMinutes: number;
  forbidTerms?: string[];
};

export type LineResult = {
  source: LineSource;
  text: string;
};

export type ModelGateway = {
  splitPlan(input: PlanSplitInput): Promise<PlanSplitResult>;
  writeStepCards(input: StepCardsInput): Promise<StepCardsResult>;
  writeStuckStory(input: StuckStoryInput): Promise<LineResult>;
  writeRestReply(input: RestReplyInput): Promise<LineResult>;
  writeReturnPopup(input: ReturnPopupInput): Promise<LineResult>;
};

export type CompanionKind = "step_card" | "stuck_story" | "rest_reply" | "return_popup";
