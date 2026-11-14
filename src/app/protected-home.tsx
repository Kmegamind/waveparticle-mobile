"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { companionById } from "@/content/companions";
import type { HomeView } from "@/lib/home/home-view";
import { ContinueLink } from "./continue-link";
import { HomeGoalOptions, HomeToast, type HomeToastState } from "./home-goal-options";

/**
 * Home of the signed-in account (#268), prototype v4: HOME-0 (first visit), HOME-1 (a Goal in
 * progress, with the Goal options sheet) and HOME-NONE (history, nothing in progress). Every value
 * comes from the account through `homeView`; nothing here is sample data.
 */
export function ProtectedHome({
  view,
  continueHref,
  sessionPagesEnabled,
}: {
  view: HomeView;
  /** From #69's `continueHref`: null when the Goal cannot be continued in this build. */
  continueHref: string | null;
  /** True when `/goal` and `/focus` exist (test builds); their links are left out otherwise. */
  sessionPagesEnabled: boolean;
}) {
  const [toast, setToast] = useState<HomeToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <main className="app-screen home-page">
      <h1 className="sr-only">Home</h1>
      {view.kind === "first" ? <FirstVisit /> : <DeskHeader />}
      {view.kind === "goal" ? (
        <>
          <section aria-label="Goal" className="home-card">
            <div className="home-card-top">
              <p className="focus-label">{`Goal · with ${view.card.companion}`}</p>
              <HomeGoalOptions goalId={view.card.goalId} onChanged={setToast} />
            </div>
            <h2 className="home-card-title">{view.card.title}</h2>
            <div>
              <p className="focus-label">Where you left it</p>
              <p className="home-step">{view.card.stepLabel}</p>
            </div>
            {view.card.line ? (
              <figure className="focus-slip home-slip">
                <span aria-hidden="true" className="focus-tape" />
                <p>{view.card.line}</p>
              </figure>
            ) : null}
            {continueHref ? <ContinueLink href={continueHref} /> : null}
            {sessionPagesEnabled ? (
              <Link className="home-link" href="/goal">
                Start something else
              </Link>
            ) : null}
          </section>
          <MyCompanions ids={view.companions} />
          <section aria-labelledby="home-in-progress" className="home-section">
            <h2 className="focus-label" id="home-in-progress">
              In progress
            </h2>
            <ul className="home-list">
              {view.inProgress.map((goal) => (
                <li key={goal.goalId}>
                  <p className="home-list-title">{goal.title}</p>
                  <p className="home-list-companion">{goal.companion}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
      {view.kind === "none" ? (
        <>
          <section aria-label="At your desk" className="home-card">
            <div className="home-trace">
              <Image
                alt="Oppenheimer"
                className="home-trace-portrait"
                height={96}
                src={companionById("oppenheimer").portrait}
                width={96}
              />
              <p className="focus-label">With Oppenheimer</p>
            </div>
            {view.carriedLine ? (
              <figure className="focus-slip home-slip">
                <span aria-hidden="true" className="focus-tape" />
                <p>{view.carriedLine}</p>
              </figure>
            ) : null}
            {sessionPagesEnabled ? (
              <Link className="button-filled" href="/goal">
                New session
              </Link>
            ) : null}
          </section>
          {view.replay.length > 0 ? (
            <section aria-labelledby="home-replay" className="home-section">
              <h2 className="focus-label" id="home-replay">
                Quick Replay
              </h2>
              <ul className="home-chips">
                {view.replay.map((goal) => (
                  <li key={goal.goalId}>
                    {sessionPagesEnabled ? (
                      <Link className="home-chip" href="/goal">
                        {goal.title}
                      </Link>
                    ) : (
                      <span className="home-chip">{goal.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      {toast ? <HomeToast onClose={closeToast} toast={toast} /> : null}
    </main>
  );
}

function FirstVisit() {
  return (
    <section aria-label="Goal" className="home-card">
      <p className="focus-label">Goal</p>
      <h2 className="home-card-title home-card-title-large">Let’s launch your first wave.</h2>
      <p className="home-card-text">Choose a Companion to start a Goal in a focused session.</p>
      <Link className="button-filled" href="/companions">
        Choose a Companion
      </Link>
    </section>
  );
}

function DeskHeader() {
  const opp = companionById("oppenheimer");
  return (
    <header className="home-desk">
      <Image alt="" className="home-desk-portrait" height={40} src={opp.portrait} width={40} />
      <p>At your desk</p>
    </header>
  );
}

function MyCompanions({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <section aria-labelledby="home-companions" className="home-section">
      <h2 className="focus-label" id="home-companions">
        My Companions
      </h2>
      <ul className="home-portraits">
        {ids.map((id) => {
          const companion = companionById(id);
          return (
            <li key={companion.id}>
              <Image
                alt={companion.shortName}
                className="home-portrait"
                height={64}
                src={companion.portrait}
                width={64}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
