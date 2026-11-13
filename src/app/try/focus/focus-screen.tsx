"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { formatClock } from "@/lib/clock";
import type { PrototypeState } from "@/lib/prototype/store";
import {
  canUndo,
  completeStep,
  isFinished,
  isHolding,
  loadSession,
  parseSpeed,
  pauseSession,
  remainingFor,
  returnOnOpen,
  saveSession,
  setReturnLine,
  setStepCards,
  startFromReturn,
  startRest,
  syncSession,
  tick,
  undoDone,
  visibleCards,
  type FocusSession,
} from "@/lib/prototype/session";
import { fullPageLoad } from "../full-page-load";
import { usePrototypeState } from "../use-prototype-state";
import { loadReturnLine, loadStepCards } from "./actions";

const TICK_MS = 250;
const SWIPE_PX = 40;

const currentTime = () => Date.now();

export function FocusScreen({ goalLine }: { goalLine: string }) {
  const { ready, state, update } = usePrototypeState();
  const hasPlan = state.goal !== null && state.steps.length > 0;

  if (!ready) {
    return <main className="app-screen try-screen" data-ready="false" />;
  }
  if (!hasPlan) {
    return (
      <main className="app-screen try-screen" data-ready="true">
        <p>There is no Goal to work on yet.</p>
        <Link href="/try">Go back to the test home</Link>
      </main>
    );
  }
  return <FocusBody goalLine={goalLine} plan={state} update={update} />;
}

function initialSession(plan: PrototypeState): FocusSession {
  const speed = parseSpeed(new URLSearchParams(window.location.search).get("speed") ?? undefined);
  const synced = syncSession(loadSession(window.localStorage), plan, speed);
  // A frozen clock restarts at once after a short absence; after Back to step or 5 minutes or
  // more away, the return pop-up (F-RET) opens first and the clock waits for Start.
  return returnOnOpen(synced, currentTime());
}

function FocusBody({
  goalLine,
  plan,
  update,
}: {
  goalLine: string;
  plan: PrototypeState;
  update: (next: PrototypeState) => void;
}) {
  const [session, setSession] = useState<FocusSession>(() => initialSession(plan));
  const [now, setNow] = useState(currentTime);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [isTestData, setIsTestData] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [toastHeldMs, setToastHeldMs] = useState<number | null>(null);
  const loading = useRef(new Set<number>());
  const timeReached = useRef(new Set<number>());
  const swipeStart = useRef<number | null>(null);
  const [returnFailed, setReturnFailed] = useState(false);
  const [returnIsTestData, setReturnIsTestData] = useState(false);
  const returnRequested = useRef(false);
  const startButton = useRef<HTMLButtonElement>(null);

  const steps = plan.steps;
  const total = steps.length;
  const index = Math.min(session.current, total - 1);
  const step = steps[index];
  const finished = isFinished(session);

  useEffect(() => saveSession(window.localStorage, session), [session]);

  // The clock is computed from timestamps; this interval only redraws it.
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = currentTime();
      setNow(at);
      setSession((current) => tick(current, at));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Leaving the page freezes the clock; coming back restarts it (foreground time only).
  useEffect(() => {
    const onVisibility = () => {
      const at = currentTime();
      setSession((current) =>
        document.visibilityState === "hidden"
          ? pauseSession(current, at)
          : returnOnOpen(current, at),
      );
    };
    const onHide = () => {
      const paused = pauseSession(loadSession(window.localStorage) ?? session, currentTime());
      saveSession(window.localStorage, paused);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [session]);

  const fetchCards = useCallback(
    (target: number) => {
      const planStep = steps[target];
      if (!planStep || loading.current.has(target)) return;
      loading.current.add(target);
      loadStepCards({ index: target, stepTitle: planStep.title, minutes: planStep.minutes })
        .catch(() => ({ status: "failed" as const }))
        .then((result) => {
          loading.current.delete(target);
          if (result.status === "ok") {
            setIsTestData(result.isTestData);
            setFailed((current) => ({ ...current, [target]: false }));
            setSession((current) => setStepCards(current, target, result.cards, currentTime()));
          } else {
            setFailed((current) => ({ ...current, [target]: true }));
          }
        });
    },
    [steps],
  );

  // Load the current Step's cards, and the next Step's ahead of time (NO-BACKUP).
  useEffect(() => {
    if (finished) return;
    if (!session.steps[index]?.cards && !failed[index]) fetchCards(index);
    if (index + 1 < total && !session.steps[index + 1]?.cards && !failed[index + 1]) {
      fetchCards(index + 1);
    }
  }, [failed, fetchCards, finished, index, session.steps, total]);

  const remaining = remainingFor(session, index, now);
  const cards = visibleCards(session, index, now);
  const shown = viewIndex === null ? cards.length - 1 : Math.min(viewIndex, cards.length - 1);
  const holding = isHolding(session, now);
  const showFailure = !session.steps[index]?.cards && failed[index] === true;

  // One polite "Step time reached" when the clock reaches 00:00 (F2).
  useEffect(() => {
    if (remaining === 0 && session.steps[index]?.clock && !timeReached.current.has(index)) {
      timeReached.current.add(index);
      setAnnouncement("Step time reached");
    }
  }, [index, remaining, session.steps]);

  const undoOpen = toastHeldMs !== null || canUndo(session, now);

  function syncStore(next: FocusSession) {
    update({ ...plan, currentStep: Math.min(next.current, total) });
  }

  function onDone() {
    const at = currentTime();
    const next = completeStep(session, at);
    if (next === session) return;
    setSession(next);
    saveSession(window.localStorage, next);
    syncStore(next);
    setViewIndex(null);
    setStepsOpen(false);
    if (isFinished(next)) {
      fullPageLoad("/try/end");
      return;
    }
    const nextStep = steps[next.current];
    setAnnouncement(`Step ${next.current + 1} of ${total}, ${nextStep.title}`);
  }

  function onUndo() {
    const at = currentTime();
    const base =
      toastHeldMs !== null && session.undo
        ? { ...session, undo: { ...session.undo, untilMs: at + toastHeldMs } }
        : session;
    const next = undoDone(base, at);
    setToastHeldMs(null);
    if (next === base) return;
    setSession(next);
    syncStore(next);
    setViewIndex(null);
    setAnnouncement(`Step ${next.current + 1} of ${total}, ${steps[next.current].title}`);
  }

  function holdToast() {
    if (toastHeldMs === null && session.undo) setToastHeldMs(session.undo.untilMs - currentTime());
  }

  function releaseToast() {
    if (toastHeldMs === null || !session.undo) return;
    const untilMs = currentTime() + toastHeldMs;
    setSession((current) =>
      current.undo ? { ...current, undo: { ...current.undo, untilMs } } : current,
    );
    setToastHeldMs(null);
  }

  // His return line for the pop-up: written once for this return and stored (#57 AC3).
  const returnPending = session.returnPending;
  const returnLine = session.returnLine;
  useEffect(() => {
    if (!returnPending || returnLine !== null || returnFailed || returnRequested.current) return;
    returnRequested.current = true;
    const pausedAt = session.pausedAtMs ?? currentTime();
    const awayMinutes = ((currentTime() - pausedAt) / 60_000) * session.speed;
    loadReturnLine({ trigger: returnPending, awayMinutes })
      .catch(() => ({ status: "failed" as const }))
      .then((result) => {
        returnRequested.current = false;
        if (result.status === "ok") {
          setReturnIsTestData(result.isTestData);
          setSession((current) =>
            current.returnPending ? setReturnLine(current, result.text) : current,
          );
        } else {
          setReturnFailed(true);
        }
      });
  }, [returnFailed, returnLine, returnPending, session.pausedAtMs, session.speed]);

  // Focus moves to Start when his line is there.
  useEffect(() => {
    if (returnPending && returnLine !== null) startButton.current?.focus();
  }, [returnLine, returnPending]);

  function onStart() {
    const next = startFromReturn(session, currentTime());
    setSession(next);
    saveSession(window.localStorage, next);
    setViewIndex(null);
  }

  function onPause() {
    const next = startRest(session, currentTime());
    setSession(next);
    saveSession(window.localStorage, next);
    fullPageLoad("/try/rest");
  }

  function onRetry() {
    setFailed((current) => ({ ...current, [index]: false }));
  }

  const earlier = () => setViewIndex(Math.max(0, shown - 1));
  const newer = () => setViewIndex(shown + 1 >= cards.length - 1 ? null : shown + 1);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    swipeStart.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStart.current === null) return;
    const dx = event.clientX - swipeStart.current;
    swipeStart.current = null;
    // Swiping the top card left shows the card before it; right brings the newer card back.
    if (dx <= -SWIPE_PX && shown > 0) earlier();
    if (dx >= SWIPE_PX && shown < cards.length - 1) newer();
  }

  if (finished && !undoOpen) {
    return (
      <main className="app-screen try-screen" data-ready="true">
        <p>Every Step of this Goal is done.</p>
        <Link href="/try">Go back to the test home</Link>
      </main>
    );
  }

  return (
    <main className="focus-page" data-ready="true">
      <div className="focus-frame" inert={returnPending !== null}>
        <header className="focus-seam">
          {total > 1 ? <p className="focus-step-label">{`Step ${index + 1} of ${total}`}</p> : null}
          <p aria-label="Time left" className="focus-clock" role="timer">
            {formatClock(remaining)}
          </p>
        </header>

        <div className="focus-middle" key={index}>
          <section aria-labelledby="his-side" className="focus-his">
            <h2 className="focus-label" id="his-side">
              My goal
            </h2>
            <p className="focus-goal-line">{goalLine}</p>
            {isTestData ? <p className="try-caption">Test data: chapter 8 cards</p> : null}

            {showFailure ? (
              <div className="focus-failure">
                <p>He is not here right now. Please try again.</p>
                <button className="button-filled" onClick={onRetry} type="button">
                  Retry
                </button>
              </div>
            ) : cards.length > 0 ? (
              <>
                <div
                  aria-label="Story cards"
                  className="focus-stack"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" && shown > 0) earlier();
                    if (event.key === "ArrowRight" && shown < cards.length - 1) newer();
                  }}
                  onPointerDown={onPointerDown}
                  onPointerUp={onPointerUp}
                  role="group"
                  tabIndex={0}
                >
                  <figure className="focus-slip" data-testid="story-card">
                    <span aria-hidden="true" className="focus-tape" />
                    <p>{cards[shown]}</p>
                  </figure>
                </div>
                <div className="focus-pager">
                  <button
                    className="button-plain button-small"
                    disabled={shown === 0}
                    onClick={earlier}
                    type="button"
                  >
                    ‹ Earlier card
                  </button>
                  <span aria-hidden="true" className="focus-dots">
                    {cards.map((card, position) => (
                      <span
                        className={position === shown ? "focus-dot focus-dot-on" : "focus-dot"}
                        key={`${position}-${card.slice(0, 8)}`}
                      />
                    ))}
                  </span>
                  <button
                    className="button-plain button-small"
                    disabled={shown >= cards.length - 1}
                    onClick={newer}
                    type="button"
                  >
                    Newer card ›
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section aria-labelledby="your-side" className="focus-yours">
            <h2 className="focus-label" id="your-side">
              Your goal
            </h2>
            <p>{plan.goal?.text}</p>
            <h2 className="focus-label">Now</h2>
            <p className="focus-step-title">{step.title}</p>
            {step.description ? <p className="focus-step-description">{step.description}</p> : null}
            {total > 1 ? (
              <>
                <button
                  aria-controls="your-steps"
                  aria-expanded={stepsOpen}
                  className="button-gray button-small"
                  onClick={() => setStepsOpen((open) => !open)}
                  type="button"
                >
                  Your Steps
                </button>
                {stepsOpen ? (
                  <ol className="focus-steps" id="your-steps">
                    {steps.map((item, position) => {
                      const status =
                        position < session.current ? "done" : position === index ? "now" : "to do";
                      return (
                        <li className="focus-steps-row" key={`${position}-${item.title}`}>
                          <span
                            aria-hidden="true"
                            className={`focus-mark focus-mark-${status.replace(" ", "-")}`}
                          />
                          <span>{item.title}</span>
                          <span className="sr-only">{`, ${status}`}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </>
            ) : null}
          </section>
        </div>

        <footer className="focus-actions">
          <button
            className="button-filled"
            disabled={holding || finished}
            onClick={onDone}
            type="button"
          >
            Done
          </button>
          <button className="button-gray" onClick={onPause} type="button">
            Pause
          </button>
        </footer>

        {undoOpen ? (
          <div
            className="focus-toast"
            onBlur={releaseToast}
            onFocus={holdToast}
            onMouseEnter={holdToast}
            onMouseLeave={releaseToast}
            role="status"
          >
            <span>Step done</span>
            <button className="focus-toast-action" onClick={onUndo} type="button">
              Undo
            </button>
          </div>
        ) : null}

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

      {returnPending ? (
        <div className="return-shade">
          <div
            aria-describedby="return-line"
            aria-modal="true"
            className="return-popup"
            role="dialog"
          >
            {returnFailed ? (
              <div className="focus-failure" id="return-line">
                <p>He is not here right now. Please try again.</p>
                <button
                  className="button-filled"
                  onClick={() => setReturnFailed(false)}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {returnIsTestData ? <p className="try-caption">Test data: return line</p> : null}
                <figure className="focus-slip" id="return-line">
                  <span aria-hidden="true" className="focus-tape" />
                  {returnLine !== null ? (
                    <p>{returnLine}</p>
                  ) : (
                    <p aria-hidden="true" className="rest-dots">
                      <span />
                      <span />
                      <span />
                    </p>
                  )}
                </figure>
                <button
                  className="button-filled"
                  disabled={returnLine === null}
                  onClick={onStart}
                  ref={startButton}
                  type="button"
                >
                  Start
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
