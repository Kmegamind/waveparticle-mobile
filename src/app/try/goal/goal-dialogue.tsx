"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CrisisPage } from "@/app/safety/crisis-page";
import {
  FIRST_OPENING,
  NOT_SURE_LINE,
  PLAN_INTRO,
  RETURNING_OPENINGS,
  SPLIT_QUESTION,
  TIME_QUESTION,
  classifyGoalShape,
  pickReturningOpening,
  reactionFor,
  splittingLine,
  timeAck,
} from "@/lib/prototype/goal-lines";
import {
  SLIDER_MAX_MINUTES,
  SLIDER_STEP_MINUTES,
  SLIDER_ZERO_HINT,
  findTimeInGoal,
  formatMinutes,
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
  moveStep,
  removeStep,
  setDescription,
  toSavedSteps,
  totalMinutes,
  type EditableStep,
  MINUTES_STEP,
  STEP_DESCRIPTION_MAX,
  STEP_TITLE_MAX,
} from "@/lib/prototype/plan-edit";
import type { SplitInput, SplitOutcome } from "@/lib/prototype/split-goal";
import { gateFreeText } from "@/lib/safety/crisis";
import { usePrototypeState } from "../use-prototype-state";
import { splitGoalAction } from "./actions";

type Phase = "goal" | "time" | "split" | "splitting" | "plan" | "failed" | "crisis";
type TimeMode = "asked" | "not-sure" | "understood" | "changed";

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
};

export function GoalDialogue({ split = splitGoalAction, start, stories }: GoalDialogueProps = {}) {
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
  const storyOpening =
    stories?.find((story) => story.id === (state.storyId ?? "site-search"))?.opening ??
    FIRST_OPENING;
  const opening = openingIndex === null ? storyOpening : RETURNING_OPENINGS[openingIndex];

  const [phase, setPhase] = useState<Phase>("goal");
  const [draft, setDraft] = useState("");
  const [goalHint, setGoalHint] = useState(false);
  const [goal, setGoal] = useState("");
  const [reaction, setReaction] = useState("");
  // TIME-SLIDER: the time question is a slider from 0 to 3 hours (Yue, 2026-11-12).
  const [sliderMinutes, setSliderMinutes] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode | null>(null);
  const [timeAnswer, setTimeAnswer] = useState("");
  const [ackLine, setAckLine] = useState("");
  const [splitFiner, setSplitFiner] = useState<boolean | null>(null);
  const [justSplit, setJustSplit] = useState(false);
  const [cameFrom, setCameFrom] = useState<Phase>("goal");
  const [waitLine, setWaitLine] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [editing, setEditing] = useState<{ id: string; title: string; description: string } | null>(
    null,
  );
  const [crisisBack, setCrisisBack] = useState<Phase>("goal");
  // One Goal id per Plan from a split: Start again for the same Plan updates that one Goal.
  const [goalId, setGoalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

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

  function chooseTime(value: number, answer: string) {
    setMinutes(value);
    setTimeAnswer(answer);
    if (timeMode === "understood" || timeMode === "changed") {
      setTimeMode("changed");
    } else {
      setTimeMode("asked");
      setAckLine(timeAck());
    }
    setPhase("split");
  }

  function chooseNotSure() {
    setMinutes(DEFAULT_MINUTES);
    setTimeAnswer("Not sure");
    setTimeMode("not-sure");
    setAckLine(NOT_SURE_LINE);
    setPhase("split");
  }

  function onSendTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sliderMinutes <= 0) return;
    chooseTime(sliderMinutes, formatMinutes(sliderMinutes));
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
    setGoalId(crypto.randomUUID());
    setSaveFailed(false);
    setSteps(fromPlan([{ title: goal.slice(0, 80), description: "", minutes: total }]));
    setEditing(null);
    setPhase("plan");
  }

  function back() {
    if (phase === "time") setPhase(timeMode === "understood" ? "split" : "goal");
    else if (phase === "split") setPhase(timeMode === "understood" ? "goal" : "time");
    else if (phase === "plan" || phase === "failed") setPhase(cameFrom);
  }

  // ----- Plan editing (#37) -----
  function openEditor(step: EditableStep) {
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    const current = committed.find((item) => item.id === step.id);
    if (!current) return;
    setEditing({ id: current.id, title: current.title, description: current.description });
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
    let next = setDescription(steps, editing.id, editing.description.trim());
    next = commitTitle(next, editing.id, editing.title);
    setSteps(next);
    setEditing(null);
    return next;
  }

  function onAddStep() {
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
    const added = addStep(committed);
    setSteps(added.steps);
    setEditing({ id: added.id, title: "", description: "" });
  }

  function openFocus(saved: StartInput["steps"]) {
    update({
      ...state,
      goal: { text: planTitle || goal, minutes: totalMinutes(saved) },
      steps: saved,
      currentStep: 0,
    });
    router.push("/try/focus");
  }

  async function onStart() {
    if (saving) return;
    const committed = editing ? finishEditing() : steps;
    if (committed === null) return;
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
        title: planTitle || goal,
        splitFiner,
        steps: saved,
      });
    } catch {
      outcome = { status: "failed" };
    }
    setSaving(false);
    if (outcome.status === "saved") openFocus(outcome.steps);
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
  const timeIsSystem = timeMode === "understood" || timeMode === "changed";
  // Just split it from the opening skips the time question entirely (#35 AC3).
  const timeAsked = afterGoal && !(justSplit && cameFrom === "goal");

  return (
    <main className="app-screen try-screen try-dialogue" data-ready={ready ? "true" : "false"}>
      <div className="try-dialogue-bar">
        {phase === "goal" ? (
          <Link aria-label="Back" className="button-plain try-back" href="/try">
            ‹
          </Link>
        ) : phase === "splitting" ? null : (
          <button aria-label="Back" className="button-plain try-back" onClick={back} type="button">
            ‹
          </button>
        )}
      </div>

      {ready ? <Slip>{opening}</Slip> : null}

      {afterGoal && goal ? <p className="try-you">{goal}</p> : null}
      {afterGoal && reaction ? <Slip>{reaction}</Slip> : null}

      {timeAsked && !timeIsSystem ? <Slip>{TIME_QUESTION}</Slip> : null}
      {timeSettled && !timeIsSystem && timeAnswer ? <p className="try-you">{timeAnswer}</p> : null}
      {timeSettled && !timeIsSystem && ackLine ? <Slip>{ackLine}</Slip> : null}
      {afterGoal && timeIsSystem && minutes !== null && phase !== "time" ? (
        <div className="try-system-row">
          <p className="try-system">Time: {formatMinutes(minutes)}</p>
          {phase === "split" ? (
            <button className="button-plain button-small" onClick={openTimeQuestion} type="button">
              Change time
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
          <div className="try-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="try-caption" role="status">
            Splitting your line into steps
          </p>
        </>
      ) : null}

      {phase === "plan" ? (
        <>
          <Slip>{PLAN_INTRO}</Slip>
          <PlanCard
            editing={editing}
            onAdd={onAddStep}
            onChangeEditing={setEditing}
            onDone={() => void finishEditing()}
            onMinutes={(id, delta) => setSteps(changeMinutes(steps, id, delta))}
            onMove={(id, by) => setSteps(moveStep(steps, id, by))}
            onOpen={openEditor}
            onRemove={(id) => {
              setSteps(removeStep(steps, id));
              setEditing(null);
            }}
            steps={steps}
            title={planTitle || goal}
          />
          <button className="try-link" onClick={splitAgain} type="button">
            Split again
          </button>
          {saveFailed ? (
            <div className="try-failure" role="alert">
              <p className="try-system">Your Goal was not saved. Please try again.</p>
              <button className="button-gray" onClick={() => void onStart()} type="button">
                Retry
              </button>
            </div>
          ) : null}
          <button
            className="button-filled"
            disabled={saving}
            onClick={() => void onStart()}
            type="button"
          >
            Start
          </button>
        </>
      ) : null}

      {phase === "failed" ? (
        <section className="try-failure" role="alert">
          <p>The split did not work. Your words are kept.</p>
          <div className="try-actions">
            <button className="button-filled" onClick={splitAgain} type="button">
              Try again
            </button>
            <button className="button-tinted" onClick={useOneStep} type="button">
              Use one step
            </button>
          </div>
          <button className="button-plain" onClick={() => setPhase("goal")} type="button">
            Change my line
          </button>
        </section>
      ) : null}

      {phase === "goal" ? (
        <>
          <form className="try-composer" onSubmit={onSendGoal}>
            <input
              aria-label="Your goal"
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write one line"
              value={draft}
            />
            <SendButton />
          </form>
          {goalHint ? (
            <p className="try-hint" role="status">
              Write one line first
            </p>
          ) : null}
          <button className="try-link" onClick={onJustSplit} type="button">
            Just split it
          </button>
        </>
      ) : null}

      {phase === "time" ? (
        <>
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
          {timeMode === "understood" ? null : (
            <div className="try-chips">
              <button className="try-chip" onClick={chooseNotSure} type="button">
                Not sure
              </button>
            </div>
          )}
          <button className="try-link" onClick={onJustSplit} type="button">
            Just split it
          </button>
        </>
      ) : null}

      {phase === "split" ? (
        <div className="try-actions">
          <button className="button-tinted" onClick={() => answerSplit(true)} type="button">
            Split it finer
          </button>
          <button className="button-gray" onClick={() => answerSplit(false)} type="button">
            Keep it broad
          </button>
        </div>
      ) : null}
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
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

type Editing = { id: string; title: string; description: string } | null;

function PlanCard(props: {
  title: string;
  steps: EditableStep[];
  editing: Editing;
  onOpen: (step: EditableStep) => void;
  onChangeEditing: (next: Editing) => void;
  onDone: () => void;
  onMinutes: (id: string, delta: number) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const { steps, editing } = props;
  return (
    <section aria-label="Plan" className="try-card try-plan">
      <h2>{props.title}</h2>
      <ol className="try-steps">
        {steps.map((step, index) => {
          const open = editing?.id === step.id;
          return (
            <li className="try-step" key={step.id}>
              {open && editing ? (
                <div className="try-step-editor">
                  <label>
                    Title
                    <input
                      autoFocus
                      maxLength={STEP_TITLE_MAX}
                      onChange={(event) =>
                        props.onChangeEditing({ ...editing, title: event.target.value })
                      }
                      value={editing.title}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={STEP_DESCRIPTION_MAX}
                      onChange={(event) =>
                        props.onChangeEditing({ ...editing, description: event.target.value })
                      }
                      rows={2}
                      value={editing.description}
                    />
                  </label>
                  <div className="try-stepper-row">
                    <div className="try-stepper">
                      <button
                        aria-label="15 minutes less"
                        disabled={step.minutes <= MINUTES_STEP}
                        onClick={() => props.onMinutes(step.id, -MINUTES_STEP)}
                        type="button"
                      >
                        −
                      </button>
                      <button
                        aria-label="15 minutes more"
                        onClick={() => props.onMinutes(step.id, MINUTES_STEP)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <span className="try-minutes">{formatMinutes(step.minutes)}</span>
                  </div>
                  <div className="try-step-tools">
                    {index > 0 ? (
                      <button
                        className="button-plain button-small"
                        onClick={() => props.onMove(step.id, -1)}
                        type="button"
                      >
                        Move up
                      </button>
                    ) : null}
                    {index < steps.length - 1 ? (
                      <button
                        className="button-plain button-small"
                        onClick={() => props.onMove(step.id, 1)}
                        type="button"
                      >
                        Move down
                      </button>
                    ) : null}
                    {canRemove(steps) ? (
                      <button
                        className="button-gray button-small"
                        onClick={() => props.onRemove(step.id)}
                        type="button"
                      >
                        Remove step
                      </button>
                    ) : null}
                    <button
                      className="button-tinted button-small"
                      onClick={props.onDone}
                      type="button"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  aria-expanded="false"
                  className="try-step-button"
                  onClick={() => props.onOpen(step)}
                  type="button"
                >
                  <span className="try-step-head">
                    <span className="try-step-title">{step.title}</span>
                    <span className="try-minutes">{formatMinutes(step.minutes)}</span>
                  </span>
                  {step.description ? (
                    <span className="try-step-description">{step.description}</span>
                  ) : null}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="try-count">{countLine(steps)}</p>
      <button className="button-gray button-small" onClick={props.onAdd} type="button">
        Add a step
      </button>
    </section>
  );
}
