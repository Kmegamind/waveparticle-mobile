"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useAppText } from "@/lib/app-text/provider";
import { formatClock } from "@/lib/clock";
import type { StepCardsRequest, StepCardsResponse } from "@/lib/prototype/focus-cards";
import type { LineResponse } from "@/lib/prototype/rest-lines";
import {
  canUndo,
  completeStep,
  isFinished,
  isHolding,
  needsCards,
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
  type ReturnTrigger,
  type SessionPlan,
} from "@/lib/prototype/session";
import { fullPageLoad } from "../try/full-page-load";
import { cardLabel } from "./card-label";
import { COMPANION } from "./companion";
import type { SessionPaths } from "./paths";

const TICK_MS = 250;
const SWIPE_PX = 40;

const currentTime = () => Date.now();

/** The Plan the focus page works through: a Goal and its Steps. */
export type FocusPlan = SessionPlan & { goal: { text: string; minutes: number } };

/**
 * What a page passes to the shared focus page (#257): /try passes its test actions and browser
 * store, the signed-in /focus passes the account's Plan and actions and records progress.
 */
export type FocusHost = {
  paths: SessionPaths;
  /** The browser key of this session's device state (clock, pauses, rest conversation). */
  storageKey: string;
  /** His static "My goal" line for the story being played. */
  goalLine: string;
  plan: FocusPlan;
  loadStepCards: (request: StepCardsRequest) => Promise<StepCardsResponse>;
  loadReturnLine: (request: {
    storyId?: string;
    trigger: ReturnTrigger;
    awayMinutes: number;
  }) => Promise<LineResponse>;
  /** The session to start from when this device has none (the account's stored progress). */
  seed?: (speed: number, nowMs: number) => FocusSession;
  /** Called after every change of the session (the account records it). */
  onProgress?: (session: FocusSession) => void;
  /** Called after Done and Undo with the new current Step (the /try store keeps it). */
  onStepChange?: (current: number) => void;
};

/** Shown when there is no Goal or no Step to work on. */
export function NoPlan({ text, paths }: { text: string; paths: SessionPaths }) {
  return (
    <main className="app-screen try-screen" data-ready="true">
      <p>{text}</p>
      <Link href={paths.home}>{paths.homeLabel}</Link>
    </main>
  );
}

function initialSession(host: FocusHost): FocusSession {
  const speed = parseSpeed(new URLSearchParams(window.location.search).get("speed") ?? undefined);
  const stored =
    loadSession(window.localStorage, host.storageKey) ?? host.seed?.(speed, currentTime()) ?? null;
  const synced = syncSession(stored, host.plan, speed);
  // A frozen clock restarts at once after a short absence; after Back to step or 5 minutes or
  // more away, the return pop-up (F-RET) opens first and the clock waits for Start.
  return returnOnOpen(synced, currentTime());
}

/** A light haptic where the device has one (#25 AC3). Nothing happens without it. */
function timeUpHaptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // No haptics on this device.
  }
}

export function FocusBody({ host }: { host: FocusHost }) {
  // The failure screens' words are app text (#288): F3 for his cards, F-RET for the return pop-up.
  const cardsFailureText = useAppText("ui.F3.fail.body");
  const cardsRetryLabel = useAppText("ui.F3.fail.retry");
  const returnFailureText = useAppText("ui.F-RET.fail.body");
  const returnRetryLabel = useAppText("ui.F-RET.fail.retry");
  const { goalLine, paths, plan, storageKey } = host;
  const [session, setSession] = useState<FocusSession>(() => initialSession(host));
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
  const returnPopup = useRef<HTMLDivElement>(null);

  const steps = plan.steps;
  const total = steps.length;
  const index = Math.min(session.current, total - 1);
  const step = steps[index];
  const finished = isFinished(session);

  const { loadReturnLine, loadStepCards, onProgress, onStepChange } = host;
  useEffect(() => {
    saveSession(window.localStorage, session, storageKey);
    onProgress?.(session);
  }, [onProgress, session, storageKey]);

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
      const paused = pauseSession(
        loadSession(window.localStorage, storageKey) ?? session,
        currentTime(),
      );
      saveSession(window.localStorage, paused, storageKey);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [session, storageKey]);

  const fetchCards = useCallback(
    (target: number) => {
      const planStep = steps[target];
      if (!planStep || loading.current.has(target)) return;
      loading.current.add(target);
      // #216: only numbers and his own earlier cards go to the server, never the Step titles.
      // CARD-NEW: the cards already known in this run, oldest first.
      const earlierCards = session.steps
        .slice(0, target)
        .flatMap((step) => (step.cards ? [step.cards.opening, ...step.cards.story] : []));
      loadStepCards({
        storyId: plan.storyId,
        index: target,
        planMinutes: steps.map((step) => step.minutes),
        earlierCards,
      })
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
    [loadStepCards, plan.storyId, session.steps, steps],
  );

  // Load the current Step's cards, and the next Step's ahead of time once this Step's cards are
  // in, so the next Step's request carries them (NO-BACKUP, CARD-NEW).
  useEffect(() => {
    if (finished) return;
    if (needsCards(session.steps[index]) && !failed[index]) fetchCards(index);
    if (
      session.steps[index]?.cards &&
      index + 1 < total &&
      needsCards(session.steps[index + 1]) &&
      !failed[index + 1]
    ) {
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
      timeUpHaptic();
    }
  }, [index, remaining, session.steps]);

  const undoOpen = toastHeldMs !== null || canUndo(session, now);

  function syncStore(next: FocusSession) {
    onStepChange?.(Math.min(next.current, total));
  }

  function onDone() {
    const at = currentTime();
    const next = completeStep(session, at);
    if (next === session) return;
    setSession(next);
    saveSession(window.localStorage, next, storageKey);
    syncStore(next);
    setViewIndex(null);
    setStepsOpen(false);
    if (isFinished(next)) {
      // /try has an end page; the signed-in page keeps the Undo toast here until #52's summary.
      if (paths.end) fullPageLoad(paths.end);
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
    loadReturnLine({ storyId: plan.storyId, trigger: returnPending, awayMinutes })
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
  }, [
    loadReturnLine,
    plan.storyId,
    returnFailed,
    returnLine,
    returnPending,
    session.pausedAtMs,
    session.speed,
  ]);

  // #5 AC5: focus moves into the pop-up at once (the page behind it is inert), and to Start when
  // his line is there.
  useEffect(() => {
    if (!returnPending) return;
    if (returnLine !== null) startButton.current?.focus();
    else returnPopup.current?.focus();
  }, [returnLine, returnPending]);

  function onStart() {
    const next = startFromReturn(session, currentTime());
    setSession(next);
    saveSession(window.localStorage, next, storageKey);
    setViewIndex(null);
  }

  function onPause() {
    const next = startRest(session, currentTime());
    setSession(next);
    saveSession(window.localStorage, next, storageKey);
    fullPageLoad(paths.rest);
  }

  // The system back control (#28 AC2, #19 AC6): an extra history entry on the same address
  // catches it. On the focus page it acts as Pause; on the return pop-up it opens Home and the
  // Step stays where it was.
  const onBackControl = useRef<() => void>(() => {});
  useEffect(() => {
    onBackControl.current = () => {
      if (session.returnPending) fullPageLoad(paths.home);
      else if (!isFinished(session)) onPause();
    };
  });
  useEffect(() => {
    window.history.pushState(window.history.state, "", window.location.href);
    const onPopState = () => onBackControl.current();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    return <NoPlan paths={paths} text="Every Step of this Goal is done." />;
  }

  return (
    <main className="focus-page" data-ready="true">
      <div className="focus-frame" inert={returnPending !== null}>
        <header className="focus-seam">
          {total > 1 ? (
            <div className="focus-seam-row">
              <p className="focus-step-label">{`Step ${index + 1} of ${total}`}</p>
              {/* The paired Step marks (FLOW 3.7, prototype v4 ticks): one pair per Step. */}
              <span aria-hidden="true" className="focus-ticks">
                {steps.map((item, position) => (
                  <span
                    className={`focus-mark focus-mark-${
                      position < session.current ? "done" : position === index ? "now" : "to-do"
                    }`}
                    key={`${position}-${item.title}`}
                  >
                    <i />
                    <i />
                  </span>
                ))}
              </span>
            </div>
          ) : null}
          {/* #5 AC1: a timer that never announces itself; 00:00 is announced once below. */}
          <p aria-label="Time left" aria-live="off" className="focus-clock" role="timer">
            {formatClock(remaining)}
          </p>
        </header>

        <div className="focus-middle" key={index}>
          <section aria-labelledby="his-side" className="focus-his">
            <div className="focus-mygoal">
              <span aria-hidden="true" className="focus-avatar">
                <span className="try-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a decorative portrait */}
                  <img alt="" src={COMPANION.portrait} />
                </span>
              </span>
              <div>
                <h2 className="focus-label" id="his-side">
                  My goal
                </h2>
                <p className="focus-goal-line">{goalLine}</p>
              </div>
            </div>
            {isTestData ? <p className="try-caption">Test data: chapter 8 cards</p> : null}

            {showFailure ? (
              <div className="focus-failure">
                <p>{cardsFailureText}</p>
                <button className="button-filled" onClick={onRetry} type="button">
                  {cardsRetryLabel}
                </button>
              </div>
            ) : cards.length > 0 ? (
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
                <figure
                  aria-current={shown === cards.length - 1 ? "true" : undefined}
                  className={cards.length > 1 ? "focus-slip focus-slip-stacked" : "focus-slip"}
                  data-testid="story-card"
                >
                  <span aria-hidden="true" className="focus-tape" />
                  <span className="focus-card-label">{cardLabel(index, shown, cards.length)}</span>
                  {/* #101 AC1: the position in words; the dots are decoration only. */}
                  <span className="sr-only">{`, Card ${shown + 1} of ${cards.length}`}</span>
                  <div className="focus-card-text">
                    <p>{cards[shown]}</p>
                  </div>
                  <span aria-hidden="true" className="focus-dots">
                    {cards.map((card, position) => (
                      <span
                        className={position === shown ? "focus-dot focus-dot-on" : "focus-dot"}
                        key={`${position}-${card.slice(0, 8)}`}
                      />
                    ))}
                  </span>
                  <div className="focus-pager">
                    <button
                      aria-label="Earlier card"
                      disabled={shown === 0}
                      onClick={earlier}
                      type="button"
                    >
                      ‹
                    </button>
                    <button
                      aria-label="Newer card"
                      disabled={shown >= cards.length - 1}
                      onClick={newer}
                      type="button"
                    >
                      ›
                    </button>
                  </div>
                </figure>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="your-side" className="focus-yours">
            <div className="focus-panel-head">
              <h2 className="focus-label" id="your-side">
                Your goal
              </h2>
              <p className="focus-panel-goal">{plan.goal?.text}</p>
              <p className="focus-panel-now">
                <span className="focus-label">Now</span> {step.title}
              </p>
              {step.description ? (
                <p className="focus-panel-now focus-step-description">{step.description}</p>
              ) : null}
            </div>
            {total > 1 ? (
              <>
                <button
                  aria-controls="your-steps"
                  aria-expanded={stepsOpen}
                  className="focus-more"
                  onClick={() => setStepsOpen((open) => !open)}
                  type="button"
                >
                  {/* One inline run, so the space before the arrow survives the flex button. */}
                  <span>
                    Your steps<span aria-hidden="true">{stepsOpen ? " ▴" : " ▾"}</span>
                  </span>
                </button>
                {stepsOpen ? (
                  <ol aria-label="Your steps" className="focus-steps" id="your-steps">
                    {steps.map((item, position) => {
                      const status =
                        position < session.current ? "done" : position === index ? "now" : "to do";
                      return (
                        <li
                          className={`focus-steps-row focus-steps-${status.replace(" ", "-")}`}
                          key={`${position}-${item.title}`}
                        >
                          <span aria-hidden="true" className="focus-steps-mark">
                            {status === "done" ? "✓" : status === "now" ? "●" : "○"}
                          </span>
                          <span>
                            {item.title}
                            <span className="sr-only">{`, ${status}`}</span>
                            {status === "now" && item.description ? (
                              <span className="focus-steps-description">{item.description}</span>
                            ) : null}
                          </span>
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
            aria-label="Back to your step"
            aria-modal="true"
            className="return-popup"
            ref={returnPopup}
            role="dialog"
            tabIndex={-1}
          >
            {returnFailed ? (
              <div className="focus-failure" id="return-line">
                <p>{returnFailureText}</p>
                <button
                  className="button-filled"
                  onClick={() => setReturnFailed(false)}
                  type="button"
                >
                  {returnRetryLabel}
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
