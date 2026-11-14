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
  pickReturningOpening,
  reactionFor,
  splitFailedLine,
  splittingLine,
  timeQuestionSlip,
} from "@/lib/prototype/goal-lines";
import {
  SLIDER_MAX_MINUTES,
  SLIDER_STEP_MINUTES,
  SLIDER_ZERO_HINT,
  findTimeInGoal,
  minutesLabel,
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
import type { SplitInput, SplitOutcome } from "@/lib/prototype/split-goal";
import { pickStory } from "@/lib/prototype/story-ids";
import { gateFreeText } from "@/lib/safety/crisis";
import { usePrototypeState } from "../use-prototype-state";
import { splitGoalAction } from "./actions";

type Phase = "goal" | "time" | "split" | "splitting" | "plan" | "failed" | "crisis";
// "understood": the time was read from the goal line (GOAL-TIME); Change keeps it until a new time
// is sent, which makes it "asked".
type TimeMode = "asked" | "not-sure" | "understood";

const DEFAULT_MINUTES = 30;

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
  /** The split; /try uses its own action (docs/decisions/0012). */
  split?: (input: SplitInput) => Promise<SplitOutcome>;
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
};

export function GoalDialogue({
  split = splitGoalAction,
  start,
  stories,
  focusPath,
  initialDraft = "",
}: GoalDialogueProps = {}) {
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
  const opening = openingIndex === null ? storyOpening : RETURNING_OPENINGS[openingIndex];

  const [phase, setPhase] = useState<Phase>("goal");
  const [draft, setDraft] = useState(initialDraft);
  const [goalHint, setGoalHint] = useState(false);
  const [goal, setGoal] = useState("");
  const [reaction, setReaction] = useState("");
  // TIME-SLIDER: the time question is a slider from 0 to 3 hours (Yue, 2026-11-12).
  const [sliderMinutes, setSliderMinutes] = useState(0);
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

  async function requestSplit(input: { goal: string; totalMinutes: number; splitFiner: boolean }) {
    setWaitLine(splittingLine());
    setPhase("splitting");
    let outcome: SplitOutcome;
    try {
      outcome = await split(input);
    } catch {
      outcome = { status: "failed" };
    }
    if (outcome.status === "crisis") {
      setDraft("");
      openCrisis("goal");
    } else if (outcome.status === "failed") {
      setPhase("failed");
    } else {
      setPlanTitle(outcome.plan.title);
      setTitleDraft(outcome.plan.title || input.goal);
      setGoalId(crypto.randomUUID());
      setSaveFailed(false);
      setSteps(fromPlan(outcome.plan.steps));
      setEditing(null);
      setPhase("plan");
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

  function onSendGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = acceptGoal();
    if (text === null) return;
    setGoal(text);
    setReaction(reactionFor(classifyGoalShape(text)));
    setSplitFiner(null);
    setJustSplit(false);
    setSliderMinutes(0);
    const understood = findTimeInGoal(text);
    if (understood !== null) {
      setMinutes(understood);
      setTimeMode("understood");
      setPhase("split");
    } else {
      setMinutes(null);
      setTimeMode(null);
      setPhase("time");
    }
  }

  function chooseTime(value: number) {
    setMinutes(value);
    setTimeMode("asked");
    setPhase("split");
  }

  function chooseNotSure() {
    setMinutes(DEFAULT_MINUTES);
    setTimeMode("not-sure");
    setPhase("split");
  }

  function onSendTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sliderMinutes <= 0) return;
    chooseTime(sliderMinutes);
  }

  function openTimeQuestion() {
    setSliderMinutes(sliderStart(minutes));
    setPhase("time");
  }

  function onJustSplit() {
    let text = goal;
    let total = minutes;
    if (phase === "goal") {
      const accepted = acceptGoal();
      if (accepted === null) return;
      text = accepted;
      setGoal(accepted);
      total = findTimeInGoal(accepted);
    }
    const finalMinutes = total ?? DEFAULT_MINUTES;
    setMinutes(finalMinutes);
    setJustSplit(true);
    setSplitFiner(false);
    setCameFrom(phase);
    void requestSplit({ goal: text, totalMinutes: finalMinutes, splitFiner: false });
  }

  function answerSplit(finer: boolean) {
    setSplitFiner(finer);
    setJustSplit(false);
    setCameFrom("split");
    void requestSplit({ goal, totalMinutes: minutes ?? DEFAULT_MINUTES, splitFiner: finer });
  }

  function splitAgain() {
    void requestSplit({
      goal,
      totalMinutes: minutes ?? DEFAULT_MINUTES,
      splitFiner: splitFiner ?? false,
    });
  }

  function useOneStep() {
    const total = minutes ?? DEFAULT_MINUTES;
    setPlanTitle(goal);
    setTitleDraft(goal);
    setGoalId(crypto.randomUUID());
    setSaveFailed(false);
    setSteps(fromPlan([{ title: goal.slice(0, 80), description: "", minutes: total }]));
    setEditing(null);
    setPhase("plan");
  }

  /** GD-F: Change my line puts the goal back in the composer. */
  function changeLine() {
    setDraft(goal);
    setPhase("goal");
  }

  function back() {
    if (phase === "time") setPhase(timeMode === "understood" ? "split" : "goal");
    else if (phase === "split") setPhase(timeMode === "understood" ? "goal" : "time");
    else if (phase === "plan" || phase === "failed") setPhase(cameFrom);
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
      setTitleDraft(planTitle || goal);
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
      router.push(`${focusPath}?goal=${encodeURIComponent(outcome.goalId)}`);
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
          <Link aria-label="Back" className="button-plain try-back" href="/try">
            ‹
          </Link>
        ) : phase === "splitting" ? (
          <span aria-hidden="true" className="try-back" />
        ) : (
          <button aria-label="Back" className="button-plain try-back" onClick={back} type="button">
            ‹
          </button>
        )}
        <span aria-hidden="true" className="try-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 40 px decorative portrait */}
          <img alt="" src={COMPANION.portrait} />
        </span>
        <span className="try-companion-name">{COMPANION.name}</span>
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
                aria-describedby={sliderMinutes <= 0 ? "try-time-hint" : undefined}
                aria-label="Your time"
                aria-valuetext={sliderValueText(sliderMinutes)}
                className="try-time-slider"
                max={SLIDER_MAX_MINUTES}
                min={0}
                onChange={(event) => setSliderMinutes(Number(event.target.value))}
                step={SLIDER_STEP_MINUTES}
                type="range"
                value={sliderMinutes}
              />
              <output aria-hidden="true" className="try-time-value">
                {sliderValueText(sliderMinutes)}
              </output>
              <SendButton disabled={sliderMinutes <= 0} />
            </form>
            {sliderMinutes <= 0 ? (
              <p className="try-hint" id="try-time-hint">
                {SLIDER_ZERO_HINT}
              </p>
            ) : null}
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
