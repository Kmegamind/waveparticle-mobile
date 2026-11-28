"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { COMPANION } from "@/app/_session/companion";
import { CrisisPage } from "@/app/safety/crisis-page";
import {
  FIRST_OPENING,
  NOT_SURE_LINE,
  PLAN_INTRO,
  RETURNING_OPENINGS,
  SPLIT_FAILED_TITLE,
  SPLIT_QUESTION,
  classifyGoalShape,
  goalLinesFor,
  pickReturningOpening,
  splitFailedLine,
  timeQuestionSlip,
} from "@/lib/prototype/goal-lines";
import {
  CAPPED_TIME_NOTE,
  SLIDER_MAX_MINUTES,
  SLIDER_STEP_MINUTES,
  SLIDER_DEFAULT_MINUTES,
  SLIDER_MIN_MINUTES,
  goalTimeWasCapped,
  minutesLabel,
  removeTimePhrase,
  sliderStart,
  sliderValueText,
} from "@/lib/prototype/goal-time";
import { loadLastOpening, saveLastOpening } from "@/lib/prototype/opening-memory";
import {
  addStep,
  canRemove,
  changeMinutes,
  commitTitle,
  countLine,
  fromPlan,
  MAX_MINUTES,
  MIN_MINUTES,
  MINUTES_CEILING_HINT,
  MINUTES_FLOOR_HINT,
  MINUTES_STEP,
  moveStep,
  NEW_STEP_MINUTES,
  PLAN_TITLE_MAX,
  planTitleFor,
  removeStep,
  setDescription,
  setMinutes as setStepMinutes,
  toSavedSteps,
  totalMinutes,
  type EditableStep,
  STEP_DESCRIPTION_MAX,
  STEP_TITLE_MAX,
} from "@/lib/prototype/plan-edit";
import type { TurnOutcome, TurnRequest } from "@/lib/goal-dialogue/turns";
import { pickStory } from "@/lib/prototype/story-ids";
import { gateFreeText } from "@/lib/safety/crisis";
import { usePrototypeState } from "../use-prototype-state";
import { goalTurnAction } from "./actions";

type Phase = "goal" | "time" | "split" | "splitting" | "plan" | "failed" | "crisis";
// "understood": the time was read from the goal line (GOAL-TIME); Change keeps it until a new time
// is sent, which makes it "asked".
type TimeMode = "asked" | "not-sure" | "understood";

const DEFAULT_MINUTES = SLIDER_DEFAULT_MINUTES;

/** A turn Try again can send again (#347). */
type Retry =
  | { turn: "split"; request: TurnRequest }
  | { turn: "goal"; text: string; justSplit: boolean }
  | { turn: "time"; value: number; mode: TimeMode };

function goalOf(request: TurnRequest): string {
  return "goal" in request ? request.goal : "";
}

/** The account save on Start (#32). Defined in src/lib/goals; /try passes nothing. */
type StartInput = {
  goalId: string;
  goalText: string;
  title: string;
  splitFiner: boolean | null;
  steps: { title: string; description: string; minutes: number }[];
};
type StartOutcome =
  | { status: "saved"; goalId: string; steps: StartInput["steps"] }
  | { status: "signed-out" | "crisis" | "invalid" | "failed" };

type GoalDialogueProps = {
  /** One turn on the server (#31); /try uses its own action (docs/decisions/0012, 0026). */
  turn?: (request: TurnRequest) => Promise<TurnOutcome>;
  /** Saves the Goal and Plan on the account before the focus page opens (/goal only). */
  start?: (input: StartInput) => Promise<StartOutcome>;
  /** The test path's stories (#254): the first opening comes from the chosen story's inputs. */
  stories?: { id: string; opening: string }[];
  /**
   * The signed-in focus page (#257). When set, Start opens it for the saved Goal and nothing is
   * written to the browser store: the account holds the Plan.
   */
  focusPath?: string;
  /** The line the composer starts with (/goal?line=, from Goals' New goal and Start; #77). */
  initialDraft?: string;
  /** Where the first ‹ goes and its name (#5 AC3): the test home on /try, Home on /goal. */
  home?: { href: string; label: string };
  /**
   * #521: a Companion other than the default one (/goal?companion=<id>). His name and portrait
   * head the dialogue, his current story's opening opens it, and Start opens /focus for him. The
   * default Companion's lines that name his own world (the opening, the canyon reactions and the
   * splitting lines) are never shown for another Companion: a line he has no version of yet reads
   * "Not written yet" (`goalLinesFor`).
   */
  voice?: { id: string; name: string; portrait: string; opening: string };
};

const TEST_HOME = { href: "/try", label: "Back to the test home" };

/** #5 AC3: the ‹ names the step it goes back to. */
const BACK_LABEL: Partial<Record<Phase, string>> = {
  goal: "Back to your goal",
  time: "Back to the time",
  split: "Back to the split question",
};

export function GoalDialogue({
  turn = goalTurnAction,
  start,
  stories,
  focusPath,
  initialDraft = "",
  home = TEST_HOME,
  voice,
}: GoalDialogueProps = {}) {
  const lines = goalLinesFor(voice ?? null);
  const router = useRouter();
  const { ready, state, update } = usePrototypeState();
  const returning = state.goal !== null;

  // Rotates through the returning pool so the line is never the previous one (#30 AC2).
  const openingIndex = useMemo(() => {
    if (!ready || !returning) return null;
    return pickReturningOpening(loadLastOpening(window.localStorage), () => 0);
  }, [ready, returning]);
  useEffect(() => {
    if (openingIndex !== null) saveLastOpening(window.localStorage, openingIndex);
  }, [openingIndex]);
  // #254: on the test path the first opening is the chosen story's own (chapter 8 when none).
  const storyOpening = stories ? pickStory(stories, state.storyId).opening : FIRST_OPENING;
  const opening = voice
    ? lines.opening
    : openingIndex === null
      ? storyOpening
      : RETURNING_OPENINGS[openingIndex];

  const [phase, setPhase] = useState<Phase>("goal");
  const [draft, setDraft] = useState(initialDraft);
  const [goalHint, setGoalHint] = useState(false);
  const [goal, setGoal] = useState("");
  const [reaction, setReaction] = useState("");
  // TIME-SLIDER: the time question is a slider from 0 to 3 hours (Yue, 2026-11-12).
  const [sliderMinutes, setSliderMinutes] = useState(SLIDER_DEFAULT_MINUTES);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode | null>(null);
  const [splitFiner, setSplitFiner] = useState<boolean | null>(null);
  const [justSplit, setJustSplit] = useState(false);
  const [cameFrom, setCameFrom] = useState<Phase>("goal");
  const [waitLine, setWaitLine] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  // The Goal field on the Plan card (#237): what Start saves as the title.
  const [titleDraft, setTitleDraft] = useState("");
  const [crisisBack, setCrisisBack] = useState<Phase>("goal");
  // One Goal id per Plan from a split: Start again for the same Plan updates that one Goal.
  const [goalId, setGoalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // The server's signed dialogue state after each turn (#31). Going back a turn reuses the
  // earlier token; a new goal line starts a new dialogue.
  const [goalToken, setGoalToken] = useState<string | null>(null);
  const [timeToken, setTimeToken] = useState<string | null>(null);
  // What Try again and Split again send (#347). For a split: after a Plan or a failed split, a
  // split-again on the token the server returned; after a request lost on the network, that same
  // request. For a goal or time turn lost on the network: that same turn. Null after a refusal,
  // which leaves the page on GD-F (owner decision 3).
  const [retry, setRetry] = useState<Retry | null>(null);
  const [sending, setSending] = useState(false);

  // The thread grows downward; each new turn scrolls it to its end, with no smooth scrolling.
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [phase]);

  function openCrisis(back: Phase) {
    setCrisisBack(back);
    setPhase("crisis");
  }

  /**
   * Sends one turn to the server (#31). A request that never got an answer (network, timeout) is
   * "unreachable", not a refusal: the server did not see it, so it can be sent again (#347).
   */
  async function sendTurn(request: TurnRequest): Promise<TurnOutcome | { status: "unreachable" }> {
    try {
      return await turn(request);
    } catch {
      return { status: "unreachable" };
    }
  }

  /** Runs a split turn: the split answer, Just split it, Split again or Try again. */
  async function requestSplit(request: TurnRequest) {
    setWaitLine(lines.splittingLine());
    setPhase("splitting");
    const outcome = await sendTurn(request);
    if (outcome.status === "crisis") {
      setDraft("");
      openCrisis("goal");
    } else if (outcome.status === "plan") {
      setRetry({
        turn: "split",
        request: { kind: "split-again", token: outcome.token, goal: goalOf(request) },
      });
      const planGoal = removeTimePhrase(outcome.plan.title || goalOf(request));
      setPlanTitle(removeTimePhrase(outcome.plan.title));
      setTitleDraft(planGoal);
      setGoalId(crypto.randomUUID());
      setSaveFailed(false);
      setSteps(fromPlan(outcome.plan.steps));
      setEditing(null);
      setPhase("plan");
    } else {
      // A failed split keeps its token so Try again stays in this dialogue; a request lost on the
      // network is sent again as it was; a refusal has nothing to retry.
      if (outcome.status === "failed") {
        setRetry({
          turn: "split",
          request: { kind: "split-again", token: outcome.token, goal: goalOf(request) },
        });
      } else {
        setRetry(outcome.status === "unreachable" ? { turn: "split", request } : null);
      }
      setPhase("failed");
    }
  }

  function acceptGoal(): string | null {
    const text = draft.trim();
    if (text.length === 0) {
      setGoalHint(true);
      return null;
    }
    setGoalHint(false);
    if (gateFreeText(text).action === "crisis-page") {
      setDraft("");
      openCrisis("goal");
      return null;
    }
    return text;
  }

  /**
   * The goal turn: always a new dialogue on the server (owner decision 2). Returns its token, or
   * null when the safety page or GD-F opened instead.
   */
  async function sendGoalTurn(
    text: string,
    justSplit: boolean,
  ): Promise<{ token: string; minutes: number | null } | null> {
    setGoal(text);
    setGoalToken(null);
    setTimeToken(null);
    setRetry(null);
    const outcome = await sendTurn({ kind: "goal", goal: text });
    if (outcome.status === "crisis") {
      setDraft("");
      openCrisis("goal");
      return null;
    }
    if (outcome.status !== "turn") {
      // Lost on the network: Try again sends the same line again (#347). Refused: nothing to retry.
      setRetry(outcome.status === "unreachable" ? { turn: "goal", text, justSplit } : null);
      setPhase("failed");
      return null;
    }
    setGoalToken(outcome.token);
    return { token: outcome.token, minutes: outcome.minutes };
  }

  async function onSendGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const text = acceptGoal();
    if (text === null) return;
    await submitGoal(text);
  }

  /** Sends the goal turn and moves on to the time or the split question. */
  async function submitGoal(text: string) {
    setSending(true);
    const accepted = await sendGoalTurn(text, false);
    setSending(false);
    if (accepted === null) return;
    setReaction(lines.reaction(classifyGoalShape(text)));
    setSplitFiner(null);
    setJustSplit(false);
    setSliderMinutes(sliderStart(null));
    if (accepted.minutes !== null) {
      setMinutes(accepted.minutes);
      setTimeMode("understood");
      setPhase("split");
    } else {
      setMinutes(null);
      setTimeMode(null);
      setPhase("time");
    }
  }

  /** The time turn, on the token of the goal turn (going back replays it, which FLOW allows). */
  async function sendTime(value: number, mode: TimeMode) {
    if (sending || goalToken === null) return;
    setSending(true);
    const outcome = await sendTurn({ kind: "time", token: goalToken, minutes: value });
    setSending(false);
    if (outcome.status !== "turn") {
      setRetry(outcome.status === "unreachable" ? { turn: "time", value, mode } : null);
      setPhase("failed");
      return;
    }
    setTimeToken(outcome.token);
    setMinutes(value);
    setTimeMode(mode);
    setPhase("split");
  }

  function chooseNotSure() {
    void sendTime(DEFAULT_MINUTES, "not-sure");
  }

  function onSendTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendTime(sliderMinutes, "asked");
  }

  function openTimeQuestion() {
    setSliderMinutes(sliderStart(minutes));
    setPhase("time");
  }

  /** The token the split answer goes on: after the time turn, or after the goal turn. */
  function answerToken(): string | null {
    if (timeMode === "asked" || timeMode === "not-sure") return timeToken;
    return goalToken;
  }

  async function onJustSplit() {
    if (sending) return;
    if (phase === "goal") {
      const accepted = acceptGoal();
      if (accepted === null) return;
      await justSplitFromGoal(accepted);
      return;
    }
    const token = answerToken();
    if (token === null) return;
    setMinutes(minutes ?? DEFAULT_MINUTES);
    setJustSplit(true);
    setSplitFiner(false);
    setCameFrom(phase);
    void requestSplit({ kind: "split", token, goal, splitFiner: null });
  }

  /** Just split it on GD1: the goal turn, then the split with no time (30 minutes). */
  async function justSplitFromGoal(text: string) {
    setSending(true);
    const sent = await sendGoalTurn(text, true);
    setSending(false);
    if (sent === null) return;
    setMinutes(sent.minutes ?? DEFAULT_MINUTES);
    setJustSplit(true);
    setSplitFiner(false);
    setCameFrom("goal");
    void requestSplit({ kind: "split", token: sent.token, goal: text, splitFiner: null });
  }

  function answerSplit(finer: boolean) {
    const token = answerToken();
    if (token === null) return;
    setSplitFiner(finer);
    setJustSplit(false);
    setCameFrom("split");
    void requestSplit({ kind: "split", token, goal, splitFiner: finer });
  }

  /** Split again (GD4) and Try again (GD-F): no limit inside the dialogue (owner decision 1). */
  function splitAgain() {
    if (retry === null) {
      // A refused turn has no dialogue to retry; the page stays on GD-F.
      setPhase("failed");
      return;
    }
    if (retry.turn === "split") void requestSplit(retry.request);
    else if (retry.turn === "time") void sendTime(retry.value, retry.mode);
    else if (retry.justSplit) void justSplitFromGoal(retry.text);
    else void submitGoal(retry.text);
  }

  function useOneStep() {
    const total = minutes ?? DEFAULT_MINUTES;
    setPlanTitle(removeTimePhrase(goal));
    setTitleDraft(removeTimePhrase(goal));
    setGoalId(crypto.randomUUID());
    setSaveFailed(false);
    setSteps(
      fromPlan([{ title: removeTimePhrase(goal).slice(0, 80), description: "", minutes: total }]),
    );
    setEditing(null);
    setPhase("plan");
  }

  /** GD-F: Change my line puts the goal back in the composer; sending it starts a new dialogue. */
  function changeLine() {
    setDraft(goal);
    setPhase("goal");
  }

  /** The phase ‹ returns to from this one. */
  function backTarget(): Phase | null {
    if (phase === "time") return timeMode === "understood" ? "split" : "goal";
    if (phase === "split") return timeMode === "understood" ? "goal" : "time";
    if (phase === "plan" || phase === "failed") return cameFrom;
    return null;
  }

  function back() {
    const target = backTarget();
    if (target) setPhase(target);
  }

  // ----- Plan editing (#37, #237, #249) -----
  function openEditor(step: EditableStep) {
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    const current = committed.find((item) => item.id === step.id);
    if (!current) return;
    setEditing({
      id: current.id,
      title: current.title,
      description: current.description,
      minutes: String(current.minutes),
    });
  }

  /** Commits the open editor. Returns the new list, or null when the safety page opened. */
  function finishEditing(): EditableStep[] | null {
    if (!editing) return steps;
    const original = steps.find((step) => step.id === editing.id);
    if (gateFreeText(`${editing.title}\n${editing.description}`).action === "crisis-page") {
      let next = commitTitle(steps, editing.id, "");
      if (original) next = setDescription(next, editing.id, original.description);
      setSteps(next);
      setEditing(null);
      openCrisis("plan");
      return null;
    }
    let next = setStepMinutes(steps, editing.id, editing.minutes);
    next = setDescription(next, editing.id, editing.description.trim());
    next = commitTitle(next, editing.id, editing.title);
    setSteps(next);
    setEditing(null);
    return next;
  }

  /** The minutes buttons (±5) and the typed field both act on the open Step (#249). */
  function applyMinutes(next: EditableStep[]) {
    if (!editing) return;
    const step = next.find((item) => item.id === editing.id);
    setSteps(next);
    if (step) setEditing({ ...editing, minutes: String(step.minutes) });
  }

  function onMinutes(delta: number) {
    if (!editing) return;
    applyMinutes(
      changeMinutes(setStepMinutes(steps, editing.id, editing.minutes), editing.id, delta),
    );
  }

  function onCommitMinutes() {
    if (!editing) return;
    applyMinutes(setStepMinutes(steps, editing.id, editing.minutes));
  }

  function onAddStep() {
    const openId = editing?.id;
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    const added = addStep(committed, openId);
    setSteps(added.steps);
    setEditing({ id: added.id, title: "", description: "", minutes: String(NEW_STEP_MINUTES) });
  }

  // After a move, focus stays on the moved Step's button and the new place is said aloud (#237).
  const moved = useRef<{ id: string; by: -1 | 1 } | null>(null);
  const [moveLine, setMoveLine] = useState("");
  function onMoveStep(id: string, by: -1 | 1) {
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    const next = moveStep(committed, id, by);
    const at = next.findIndex((step) => step.id === id);
    moved.current = { id, by };
    setMoveLine(at < 0 ? "" : `${next[at].title} moved to step ${at + 1}.`);
    setSteps(next);
  }
  useEffect(() => {
    const target = moved.current;
    if (!target || !thread.current) return;
    moved.current = null;
    const find = (by: -1 | 1) =>
      thread.current?.querySelector<HTMLButtonElement>(
        `[data-step="${target.id}"][data-move="${by}"]`,
      );
    const same = find(target.by);
    (same && !same.disabled ? same : find(target.by === 1 ? -1 : 1))?.focus();
  }, [steps]);

  function openFocus(saved: StartInput["steps"]) {
    update({
      ...state,
      goal: { text: planTitleFor(titleDraft, goal), minutes: totalMinutes(saved) },
      steps: saved,
      currentStep: 0,
    });
    router.push("/try/focus");
  }

  async function onStart() {
    if (saving) return;
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    // The Goal field is the user's own text: it passes the same safety gate as a Step (#237).
    if (gateFreeText(titleDraft).action === "crisis-page") {
      setTitleDraft(planTitle || removeTimePhrase(goal));
      openCrisis("plan");
      return;
    }
    const saved = toSavedSteps(committed);
    if (saved.length === 0) return;
    if (!start) {
      openFocus(saved);
      return;
    }
    // #32: the Goal and Plan are saved on the account before the focus page opens.
    setSaving(true);
    setSaveFailed(false);
    let outcome: StartOutcome;
    try {
      outcome = await start({
        goalId,
        goalText: goal,
        title: planTitleFor(titleDraft, goal),
        splitFiner,
        steps: saved,
      });
    } catch {
      outcome = { status: "failed" };
    }
    setSaving(false);
    if (outcome.status === "saved" && focusPath) {
      const companion = voice ? `&companion=${encodeURIComponent(voice.id)}` : "";
      router.push(`${focusPath}?goal=${encodeURIComponent(outcome.goalId)}${companion}`);
    } else if (outcome.status === "saved") openFocus(outcome.steps);
    else if (outcome.status === "crisis") openCrisis("plan");
    else if (outcome.status === "signed-out") router.push("/auth/sign-in");
    else setSaveFailed(true);
  }

  if (phase === "crisis") {
    return (
      <CrisisPage
        onBack={() => {
          setPhase(crisisBack);
        }}
      />
    );
  }

  const afterGoal = phase !== "goal";
  const timeSettled = minutes !== null && phase !== "time";
  const showSplitQuestion =
    !justSplit && (phase === "split" || (afterGoal && phase !== "time" && splitFiner !== null));
  const understood = timeMode === "understood";
  // Just split it from the opening skips the time question entirely (#35 AC3).
  const timeAsked = afterGoal && !(justSplit && cameFrom === "goal");
  // Prototype v4: no reaction when the time was read from the line, until Change asks again.
  const showTimeQuestion = timeAsked && Boolean(reaction) && (!understood || phase === "time");

  return (
    <main className="app-screen try-screen try-dialogue" data-ready={ready ? "true" : "false"}>
      <div className="try-dialogue-bar">
        {phase === "goal" ? (
          <Link aria-label={home.label} className="button-plain try-back" href={home.href}>
            ‹
          </Link>
        ) : phase === "splitting" ? (
          <span aria-hidden="true" className="try-back" />
        ) : (
          <button
            aria-label={BACK_LABEL[backTarget() ?? "goal"] ?? "Back"}
            className="button-plain try-back"
            onClick={back}
            type="button"
          >
            ‹
          </button>
        )}
        <span aria-hidden="true" className="try-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 40 px decorative portrait */}
          <img alt="" src={voice?.portrait ?? COMPANION.portrait} />
        </span>
        <span className="try-companion-name">{voice?.name ?? COMPANION.name}</span>
      </div>

      <div className="try-thread" ref={thread}>
        {ready ? <Slip>{opening}</Slip> : null}

        {afterGoal && goal ? <p className="try-you">{goal}</p> : null}
        {showTimeQuestion ? <Slip>{timeQuestionSlip(reaction)}</Slip> : null}

        {timeSettled && timeMode === "asked" ? (
          <p className="try-you">{minutesLabel(minutes)}</p>
        ) : null}
        {timeSettled && timeMode === "not-sure" ? (
          <>
            <p className="try-you">Not sure</p>
            <Slip>{NOT_SURE_LINE}</Slip>
          </>
        ) : null}
        {afterGoal && understood && minutes !== null && phase !== "time" ? (
          <div className="try-system-row">
            <p className="try-caption-line" role="status">
              Time I understood from your line: <b>{minutesLabel(minutes)}</b>.
            </p>
            {phase === "split" ? (
              <button
                aria-label="Change time"
                className="try-link"
                onClick={openTimeQuestion}
                type="button"
              >
                Change
              </button>
            ) : null}
          </div>
        ) : null}

        {showSplitQuestion ? <Slip>{SPLIT_QUESTION}</Slip> : null}
        {showSplitQuestion && phase !== "split" && splitFiner !== null ? (
          <p className="try-you">{splitFiner ? "Split it finer" : "Keep it broad"}</p>
        ) : null}

        {phase === "splitting" ? (
          <>
            <Slip>{waitLine}</Slip>
            <div className="try-typing" role="status">
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span className="sr-only">Splitting your line into steps</span>
            </div>
          </>
        ) : null}

        {phase === "plan" ? (
          <>
            <Slip>{PLAN_INTRO}</Slip>
            {understood && goalTimeWasCapped(goal) && minutes === SLIDER_MAX_MINUTES ? (
              <p className="try-caption-line" role="status">
                {CAPPED_TIME_NOTE}
              </p>
            ) : null}
            <PlanCard
              editing={editing}
              onAdd={onAddStep}
              onChangeEditing={setEditing}
              onCommitMinutes={onCommitMinutes}
              onDone={() => void finishEditing()}
              onMinutes={onMinutes}
              onMove={onMoveStep}
              onOpen={openEditor}
              onRemove={(id) => {
                setSteps(removeStep(steps, id));
                setEditing(null);
              }}
              onSplitAgain={splitAgain}
              moveLine={moveLine}
              onTitle={setTitleDraft}
              steps={steps}
              title={titleDraft}
            />
          </>
        ) : null}

        {phase === "failed" ? (
          <section aria-labelledby="split-failed" className="try-sys" role="alert">
            <h2 id="split-failed">{SPLIT_FAILED_TITLE}</h2>
            <p>{splitFailedLine(goal)}</p>
            <button className="button-filled" onClick={splitAgain} type="button">
              Try again
            </button>
            <button className="button-gray" onClick={useOneStep} type="button">
              Use one step
            </button>
            <button className="try-link try-link-centre" onClick={changeLine} type="button">
              Change my line
            </button>
          </section>
        ) : null}
      </div>

      <div className="try-dock">
        {phase === "goal" ? (
          <>
            <form className="try-composer" onSubmit={onSendGoal}>
              <input
                aria-label="Your goal"
                autoComplete="off"
                className="try-field"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Say it in one line"
                value={draft}
              />
              <SendButton />
            </form>
            {goalHint ? (
              <p className="try-hint" role="status">
                Write one line first
              </p>
            ) : null}
            <button className="try-link try-link-centre" onClick={onJustSplit} type="button">
              Just split it
            </button>
          </>
        ) : null}

        {phase === "time" ? (
          <>
            {understood ? null : (
              <div aria-label="Quick replies" className="try-chips" role="group">
                <button className="try-chip" onClick={chooseNotSure} type="button">
                  Not sure
                </button>
              </div>
            )}
            <form className="try-time" onSubmit={onSendTime}>
              <input
                aria-label="Your time"
                aria-valuetext={sliderValueText(sliderMinutes)}
                className="try-time-slider"
                max={SLIDER_MAX_MINUTES}
                min={SLIDER_MIN_MINUTES}
                onChange={(event) => setSliderMinutes(Number(event.target.value))}
                step={SLIDER_STEP_MINUTES}
                type="range"
                value={sliderMinutes}
              />
              <output aria-hidden="true" className="try-time-value">
                {sliderValueText(sliderMinutes)}
              </output>
              <SendButton />
            </form>
          </>
        ) : null}

        {phase === "split" ? (
          <div aria-label="Quick replies" className="try-chips" role="group">
            <button className="try-chip" onClick={() => answerSplit(true)} type="button">
              Split it finer
            </button>
            <button className="try-chip" onClick={() => answerSplit(false)} type="button">
              Keep it broad
            </button>
          </div>
        ) : null}

        {phase === "plan" ? (
          <>
            {saveFailed ? (
              <div className="try-save-failed" role="alert">
                <p className="try-system">Your Goal was not saved. Please try again.</p>
                <button className="button-gray" onClick={() => void onStart()} type="button">
                  Retry
                </button>
              </div>
            ) : null}
            <button
              className="button-filled try-start"
              disabled={saving}
              onClick={() => void onStart()}
              type="button"
            >
              Start
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Slip({ children }: { children: string }) {
  return <p className="try-slip">{children}</p>;
}

function SendButton(props: { disabled?: boolean }) {
  return (
    // aria-disabled, not disabled: an inactive Send stays in the Tab order with its reason.
    <button
      aria-disabled={props.disabled ? true : undefined}
      aria-label="Send"
      className="try-send"
      type="submit"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** The open Step editor; `minutes` is the typed field's text until it is committed (#249). */
type Editing = { id: string; title: string; description: string; minutes: string } | null;

function PlanCard(props: {
  title: string;
  moveLine: string;
  onTitle: (value: string) => void;
  steps: EditableStep[];
  editing: Editing;
  onOpen: (step: EditableStep) => void;
  onChangeEditing: (next: Editing) => void;
  onDone: () => void;
  onMinutes: (delta: number) => void;
  onCommitMinutes: () => void;
  onMove: (id: string, by: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onSplitAgain: () => void;
}) {
  const { steps, editing } = props;
  return (
    <section aria-labelledby="plan-over" className="try-card try-plan" role="group">
      <p className="try-over" id="plan-over">
        Your steps
      </p>
      <label className="try-plan-goal">
        <span className="try-caption-line">Goal</span>
        <input
          className="try-field try-field-plan"
          maxLength={PLAN_TITLE_MAX}
          onChange={(event) => props.onTitle(event.target.value)}
          value={props.title}
        />
      </label>
      <ol className="try-steps">
        {steps.map((step, index) => {
          const open = editing?.id === step.id;
          if (open && editing) {
            const atFloor = step.minutes <= MIN_MINUTES;
            const atCeiling = step.minutes >= MAX_MINUTES;
            return (
              <li className="try-step" key={step.id}>
                <div className="try-step-open">
                  <span className="try-step-number">{index + 1}</span>
                  <span className="try-step-title">Editing</span>
                  <span className="try-minutes">{minutesLabel(step.minutes)}</span>
                </div>
                <div className="try-step-editor">
                  <label>
                    <span className="try-caption-line">Step title</span>
                    <input
                      autoFocus
                      className="try-field"
                      maxLength={STEP_TITLE_MAX}
                      onChange={(event) =>
                        props.onChangeEditing({ ...editing, title: event.target.value })
                      }
                      value={editing.title}
                    />
                  </label>
                  <label>
                    <span className="try-caption-line">Description</span>
                    <textarea
                      className="try-field try-field-area"
                      maxLength={STEP_DESCRIPTION_MAX}
                      onChange={(event) =>
                        props.onChangeEditing({ ...editing, description: event.target.value })
                      }
                      rows={2}
                      value={editing.description}
                    />
                  </label>
                  <div aria-label="Minutes" className="try-stepper" role="group">
                    <button
                      aria-describedby={atFloor ? "try-minutes-hint" : undefined}
                      aria-disabled={atFloor ? true : undefined}
                      aria-label="Five minutes fewer"
                      onClick={() => {
                        if (!atFloor) props.onMinutes(-MINUTES_STEP);
                      }}
                      type="button"
                    >
                      −
                    </button>
                    <input
                      aria-label="Minutes"
                      className="try-field try-stepper-field"
                      inputMode="numeric"
                      max={MAX_MINUTES}
                      min={MIN_MINUTES}
                      onBlur={props.onCommitMinutes}
                      onChange={(event) =>
                        props.onChangeEditing({ ...editing, minutes: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") props.onCommitMinutes();
                      }}
                      type="number"
                      value={editing.minutes}
                    />
                    <button
                      aria-describedby={atCeiling ? "try-minutes-hint" : undefined}
                      aria-disabled={atCeiling ? true : undefined}
                      aria-label="Five minutes more"
                      onClick={() => {
                        if (!atCeiling) props.onMinutes(MINUTES_STEP);
                      }}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  {atFloor || atCeiling ? (
                    <p className="try-hint" id="try-minutes-hint">
                      {atFloor ? MINUTES_FLOOR_HINT : MINUTES_CEILING_HINT}
                    </p>
                  ) : null}
                  <div className="try-step-tools">
                    <button
                      className="button-gray button-small"
                      onClick={props.onDone}
                      type="button"
                    >
                      Done editing
                    </button>
                    {canRemove(steps) ? (
                      <button
                        className="try-link"
                        onClick={() => props.onRemove(step.id)}
                        type="button"
                      >
                        Remove step
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          }
          return (
            <li className="try-step try-step-row" key={step.id}>
              <button
                aria-expanded="false"
                className="try-step-button"
                onClick={() => props.onOpen(step)}
                type="button"
              >
                <span className="try-step-number">{index + 1}</span>
                <span className="try-step-title">{step.title}</span>
                <span className="try-minutes">{minutesLabel(step.minutes)}</span>
              </button>
              <span className="try-move">
                <button
                  aria-label={`Move up: ${step.title}`}
                  data-move="-1"
                  data-step={step.id}
                  disabled={index === 0}
                  onClick={() => props.onMove(step.id, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move down: ${step.title}`}
                  data-move="1"
                  data-step={step.id}
                  disabled={index === steps.length - 1}
                  onClick={() => props.onMove(step.id, 1)}
                  type="button"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status">
        {props.moveLine}
      </p>
      <div className="try-plan-foot">
        <button className="try-link" onClick={props.onAdd} type="button">
          + Add a step
        </button>
        <span className="try-caption-line">{countLine(steps)}</span>
      </div>
      <button className="try-link try-link-centre" onClick={props.onSplitAgain} type="button">
        Split again
      </button>
    </section>
  );
}
