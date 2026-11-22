"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { gateFreeText } from "@/lib/safety/crisis";
import type { PauseResponse, RestReplyResponse } from "@/lib/prototype/rest-lines";
import {
  addPauseMessage,
  addRestMessage,
  backFromRest,
  hasFirstRestMessage,
  leaveRest,
  pauseHistory,
  saveSession,
  setRestDraft,
  startRest,
  visibleCards,
  type FocusSession,
  type RestMessage,
} from "@/lib/prototype/session";
import { useAppText } from "@/lib/app-text/provider";
import { CrisisPage } from "../safety/crisis-page";
import { fullPageLoad } from "../try/full-page-load";
import type { FocusPlan } from "./focus-body";
import type { SessionPaths } from "./paths";

/** His first message arrives one to two and a half seconds after Pause (FLOW R1). */
const FIRST_MESSAGE_MIN_MS = 1_000;
/** Three quiet dots appear only when a reply takes longer than this (FLOW R1). */
const DOTS_AFTER_MS = 600;

const currentTime = () => Date.now();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a page passes to the shared rest page (#257); see `FocusHost`. */
export type RestHost = {
  paths: SessionPaths;
  storageKey: string;
  plan: FocusPlan;
  /** The session as this device left it (or as rebuilt from the account). */
  stored: FocusSession;
  loadPauseMessage: (request: {
    storyId?: string;
    pauseNumber: number;
    stepTitle: string;
    lastCard?: string;
    recentCategories?: string[];
    usedProps?: string[];
    earlierStories?: string[];
    earlierLines?: string[];
  }) => Promise<PauseResponse>;
  loadRestReply: (request: {
    storyId?: string;
    message: string;
    history: RestMessage[];
    replyIndex: number;
    stepIndex?: number;
    stepCount?: number;
  }) => Promise<RestReplyResponse>;
  onProgress?: (session: FocusSession) => void;
};

function focusHref(paths: SessionPaths, session: FocusSession): string {
  return session.speed === 1 ? paths.focus : `${paths.focus}?speed=${session.speed}`;
}

export function RestBody({ host }: { host: RestHost }) {
  const { paths, plan, stored, storageKey, loadPauseMessage, loadRestReply, onProgress } = host;
  const failureText = useAppText("ui.R1.fail.body");
  const retryLabel = useAppText("ui.R1.fail.retry");
  // Arriving here without an open rest is a Pause; an open rest is shown again as it was.
  const [session, setSession] = useState<FocusSession>(() =>
    stored.rest ? stored : startRest(stored, currentTime()),
  );
  const [isTestData, setIsTestData] = useState(false);
  const [firstFailed, setFirstFailed] = useState(false);
  const [replyFailed, setReplyFailed] = useState(
    () => stored.rest?.messages.at(-1)?.from === "you",
  );
  const [waiting, setWaiting] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const firstRequested = useRef(false);

  const rest = session.rest;
  const messages = rest?.messages ?? [];
  const stepTitle = plan.steps[session.current]?.title ?? "";

  useEffect(() => {
    saveSession(window.localStorage, session, storageKey);
    onProgress?.(session);
  }, [onProgress, session, storageKey]);

  // His first message: written for this Pause, with its number (F1, PAUSE-3), in two calls (#56):
  // the stuck story, then his words about it. The earlier Pauses go along so the code picks a new
  // category and prop.
  useEffect(() => {
    if (!rest || hasFirstRestMessage(session) || firstFailed || firstRequested.current) return;
    firstRequested.current = true;
    const lastCard = visibleCards(session, session.current, currentTime()).at(-1);
    Promise.all([
      loadPauseMessage({
        storyId: plan.storyId,
        pauseNumber: rest.pauseNumber,
        stepTitle,
        lastCard,
        ...pauseHistory(session),
      }).catch(() => ({
        status: "failed" as const,
      })),
      wait(FIRST_MESSAGE_MIN_MS),
    ]).then(([result]) => {
      firstRequested.current = false;
      if (result.status === "ok") {
        setIsTestData(result.isTestData);
        setSession((current) => addPauseMessage(current, result));
      } else {
        setFirstFailed(true);
      }
    });
  }, [firstFailed, loadPauseMessage, plan.storyId, rest, session, stepTitle]);

  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setShowDots(true), DOTS_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);

  function askForReply(message: string, history: RestMessage[]) {
    setShowDots(false);
    setWaiting(true);
    setReplyFailed(false);
    const replyIndex = Math.max(0, history.filter((item) => item.from === "him").length - 1);
    // The Step's position only, never its title: it says which parts of his Story are later (#60).
    loadRestReply({
      storyId: plan.storyId,
      message,
      history,
      replyIndex,
      stepIndex: session.current,
      stepCount: plan.steps.length,
    })
      .catch(() => ({ status: "failed" as const }))
      .then((result) => {
        setWaiting(false);
        if (result.status === "ok") {
          setIsTestData(result.isTestData);
          setSession((current) => addRestMessage(current, { from: "him", text: result.text }));
        } else if (result.status === "crisis") {
          setCrisis(true);
        } else {
          setReplyFailed(true);
        }
      });
  }

  function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rest || waiting) return;
    const text = rest.draft.trim();
    if (text.length === 0) return;
    // Every message passes the safety gate first; crisis text is discarded and never sent.
    if (gateFreeText(text).action === "crisis-page") {
      setSession((current) => setRestDraft(current, ""));
      setCrisis(true);
      return;
    }
    const history = rest.messages;
    setSession((current) => setRestDraft(addRestMessage(current, { from: "you", text }), ""));
    askForReply(text, history);
  }

  function onRetryReply() {
    const last = messages.at(-1);
    if (last?.from !== "you") return;
    askForReply(last.text, messages.slice(0, -1));
  }

  function leave(next: FocusSession, href: string) {
    saveSession(window.localStorage, next, storageKey);
    setSession(next);
    fullPageLoad(href);
  }

  function onBack() {
    leave(backFromRest(session), focusHref(paths, session));
  }

  function onHome(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    leave(leaveRest(session), paths.home);
  }

  if (crisis) {
    // The text that triggered the safety page was never kept; Back returns with an empty field.
    return <CrisisPage onBack={() => setCrisis(false)} />;
  }

  return (
    <main className="rest-page" data-ready="true">
      <header className="rest-header">
        <button className="button-plain button-small" onClick={onBack} type="button">
          <span aria-hidden="true">‹&nbsp;</span>Back to step
        </button>
        <p className="rest-status">Paused</p>
        <Link className="rest-home" href={paths.home} onClick={onHome}>
          Home
        </Link>
      </header>

      <section aria-label="Conversation" aria-live="polite" className="rest-log">
        {isTestData ? <p className="try-caption">Test data: chapter 8 rest lines</p> : null}
        {firstFailed ? (
          <div className="rest-failure">
            <p>{failureText}</p>
            <button
              className="button-filled button-small"
              onClick={() => setFirstFailed(false)}
              type="button"
            >
              {retryLabel}
            </button>
          </div>
        ) : null}
        {rest?.stuckStory && hasFirstRestMessage(session) ? (
          <figure className="rest-slip" data-testid="his-stuck-story">
            <span aria-hidden="true" className="focus-tape" />
            <p>{rest.stuckStory}</p>
          </figure>
        ) : null}
        {messages.map((message, position) =>
          message.from === "him" ? (
            <figure className="rest-slip" data-testid="his-message" key={position}>
              <span aria-hidden="true" className="focus-tape" />
              <p>{message.text}</p>
            </figure>
          ) : (
            <p className="rest-yours" data-testid="your-message" key={position}>
              {message.text}
            </p>
          ),
        )}
        {waiting && showDots ? (
          <p aria-hidden="true" className="rest-dots">
            <span />
            <span />
            <span />
          </p>
        ) : null}
        {replyFailed && !waiting ? (
          <div className="rest-failure">
            <p>{failureText}</p>
            <button className="button-filled button-small" onClick={onRetryReply} type="button">
              {retryLabel}
            </button>
          </div>
        ) : null}
      </section>

      <form className="rest-composer" onSubmit={onSend}>
        <label className="sr-only" htmlFor="rest-message">
          Message
        </label>
        <input
          autoComplete="off"
          className="rest-field"
          id="rest-message"
          onChange={(event) => {
            const draft = event.target.value;
            setSession((current) => setRestDraft(current, draft));
          }}
          type="text"
          value={rest?.draft ?? ""}
        />
        <button aria-label="Send" className="rest-send" disabled={waiting} type="submit">
          <span aria-hidden="true">↑</span>
        </button>
      </form>
    </main>
  );
}
