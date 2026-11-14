"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  SHOW_FIRST,
  goalsLists,
  matchesSearch,
  type GoalRow,
  type GoalStatus,
  type GoalsData,
  type GoalsTab,
  type HistoryRow,
} from "@/lib/goals/goals-view";
import { GoalMenu, NewGoalSheet, Toast, keptDraft } from "./goal-sheets";
import { useGoalChanges } from "./use-goal-changes";
import { useLocalNow } from "./use-local-now";

/** Goals (prototype v4 G1, G2b, G3, G5, G5-D, G6; #73, #77, #79, #80). */

const TABS: { id: GoalsTab; label: string }[] = [
  { id: "progress", label: "In progress" },
  { id: "hold", label: "On hold" },
  { id: "done", label: "Done" },
  { id: "history", label: "History" },
];

const EMPTY: Record<GoalsTab, string> = {
  progress: "No goals yet.",
  hold: "Nothing on hold.",
  done: "Nothing finished yet.",
  history: "Your sessions will show up here.",
};

const EPOCH = { now: new Date(0), timeZone: "UTC" };

export function GoalsScreen({
  data,
  initialTab,
  sessionPagesEnabled,
}: {
  data: GoalsData;
  initialTab: GoalsTab;
  sessionPagesEnabled: boolean;
}) {
  const router = useRouter();
  const local = useLocalNow();
  const [tab, setTab] = useState<GoalsTab>(initialTab);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState<{ goalId: string; status: GoalStatus } | null>(null);
  const [newGoal, setNewGoal] = useState<{ draft: string; opened: number } | null>(null);
  const [openings, setOpenings] = useState(0);
  const openNewGoal = () => {
    setOpenings((count) => count + 1);
    setNewGoal({ draft: keptDraft(), opened: openings + 1 });
  };
  const { toast, busy, change, undo, close } = useGoalChanges();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const lists = useMemo(
    () => goalsLists(data, { ...(local ?? EPOCH), sessionPagesEnabled }),
    [data, local, sessionPagesEnabled],
  );
  const ready = local !== null;

  function choose(next: GoalsTab) {
    setTab(next);
    router.replace(next === "progress" ? "/goals" : `/goals?tab=${next}`, { scroll: false });
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    tabRefs.current[next]?.focus();
    choose(TABS[next].id);
  }

  const visible = (row: { title: string }) => matchesSearch(query, row.title);

  function rowsPanel(rows: GoalRow[], grouped: boolean) {
    const filtered = rows.filter(visible);
    if (filtered.length === 0) return <Empty tab={tab} query={query} onNew={newGoalLink} />;
    const shown = grouped && !showAll ? filtered.slice(0, SHOW_FIRST) : filtered;
    const render = (row: GoalRow) => (
      <Row
        busy={busy}
        key={row.id}
        onChange={(kind) => void change(kind, row.id)}
        onMenu={() => setMenu({ goalId: row.id, status: row.status })}
        ready={ready}
        row={row}
      />
    );
    if (!grouped) return <div className="goals-rows">{shown.map(render)}</div>;
    const ongoing = shown.filter((row) => lists.ongoing.some((item) => item.id === row.id));
    const oneTime = shown.filter((row) => !ongoing.includes(row));
    return (
      <>
        {ongoing.length > 0 ? <h2 className="goals-group">Ongoing</h2> : null}
        {ongoing.map(render)}
        {oneTime.length > 0 ? <h2 className="goals-group">One-time</h2> : null}
        {oneTime.map(render)}
        {!showAll && filtered.length > SHOW_FIRST ? (
          <button className="try-link goals-more" onClick={() => setShowAll(true)} type="button">
            Show more
          </button>
        ) : null}
      </>
    );
  }

  const newGoalLink = sessionPagesEnabled ? openNewGoal : null;

  return (
    <main className="app-screen goals-page" data-ready={ready ? "true" : "false"}>
      <div className="goals-head">
        <h1>Goals</h1>
        {sessionPagesEnabled ? (
          <button
            aria-label="New goal"
            className="button-gray button-small"
            onClick={openNewGoal}
            type="button"
          >
            + New goal
          </button>
        ) : null}
      </div>
      <input
        aria-label="Search goals and history"
        className="goals-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search goals and history"
        type="search"
        value={query}
      />
      <div aria-label="Goal lists" className="goals-tabs" role="tablist">
        {TABS.map((item, index) => (
          <button
            aria-controls="goals-panel"
            aria-label={`${item.label}, tab ${index + 1} of ${TABS.length}`}
            aria-selected={tab === item.id}
            id={`goals-tab-${item.id}`}
            key={item.id}
            onClick={() => choose(item.id)}
            onKeyDown={(event) => onTabKey(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <section
        aria-labelledby={`goals-tab-${tab}`}
        className="goals-panel"
        id="goals-panel"
        role="tabpanel"
      >
        {tab === "progress" ? rowsPanel([...lists.ongoing, ...lists.oneTime], true) : null}
        {tab === "hold" ? rowsPanel(lists.hold, false) : null}
        {tab === "done" ? rowsPanel(lists.done, false) : null}
        {tab === "history" ? (
          <History
            query={query}
            ready={ready}
            rows={lists.history.filter((row) => matchesSearch(query, row.goalTitle))}
          />
        ) : null}
      </section>

      <GoalMenu
        busy={busy}
        onChoose={(status) => {
          const target = menu;
          setMenu(null);
          if (target) void change(status, target.goalId);
        }}
        onClose={() => setMenu(null)}
        status={menu?.status ?? null}
      />
      <NewGoalSheet
        initialDraft={newGoal?.draft ?? ""}
        key={newGoal?.opened ?? 0}
        onClose={() => setNewGoal(null)}
        open={newGoal !== null}
      />
      {toast ? <Toast onClose={close} onUndo={() => void undo()} toast={toast} /> : null}
    </main>
  );
}

function Row({
  row,
  ready,
  busy,
  onChange,
  onMenu,
}: {
  row: GoalRow;
  ready: boolean;
  busy: boolean;
  onChange: (kind: "resume" | "reopen") => void;
  onMenu: () => void;
}) {
  return (
    <div className="goals-row">
      <Link className="goals-row-open" href={`/goals/${row.id}`}>
        <span aria-hidden="true" className="try-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 40 px decorative portrait */}
          <img alt="" src={row.portrait} />
        </span>
        <span className="goals-row-text">
          <span className="goals-row-title">{row.title}</span>
          {ready && row.activity ? <small>{row.activity}</small> : null}
        </span>
      </Link>
      {row.action === "continue" || row.action === "start" ? (
        // A plain link, not next/link: the focus page loads fresh and applies the return rule.
        <a
          aria-label={`${row.action === "continue" ? "Continue" : "Start"} ${row.title}`}
          className="button-gray button-small goals-action"
          href={row.actionHref ?? undefined}
        >
          {row.action === "continue" ? "Continue" : "Start"}
        </a>
      ) : null}
      {row.action === "resume" || row.action === "reopen" ? (
        <button
          aria-label={`${row.action === "resume" ? "Resume" : "Reopen"} ${row.title}`}
          className="button-gray button-small goals-action"
          disabled={busy}
          onClick={() => onChange(row.action as "resume" | "reopen")}
          type="button"
        >
          {row.action === "resume" ? "Resume" : "Reopen"}
        </button>
      ) : null}
      <button
        aria-haspopup="dialog"
        aria-label={`More actions for ${row.title}`}
        className="home-more"
        onClick={onMenu}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>
    </div>
  );
}

function Empty({
  tab,
  query,
  onNew,
}: {
  tab: GoalsTab;
  query: string;
  onNew: (() => void) | null;
}) {
  if (query.trim()) return <p className="goals-empty">No matches.</p>;
  return (
    <p className="goals-empty">
      {EMPTY[tab]}
      {tab === "progress" && onNew ? (
        <>
          {" "}
          <button className="try-link" onClick={onNew} type="button">
            New goal
          </button>
        </>
      ) : null}
    </p>
  );
}

function History({ rows, query, ready }: { rows: HistoryRow[]; query: string; ready: boolean }) {
  if (rows.length === 0) {
    return <p className="goals-empty">{query.trim() ? "No matches." : EMPTY.history}</p>;
  }
  return <HistoryList ready={ready} rows={rows} />;
}

export function HistoryList({ rows, ready }: { rows: HistoryRow[]; ready: boolean }) {
  return (
    <ul className="goals-history">
      {rows.map((row) => (
        <li key={row.sessionId}>
          <span className="goals-history-main">
            <span className="goals-history-title">
              {ready ? `${row.date} · ` : ""}
              {row.goalTitle}
            </span>
            {row.doneSteps.length > 0 ? (
              <span className="goals-caption">{row.doneSteps.join(", ")}</span>
            ) : null}
          </span>
          <span className="goals-caption">{row.minutes} min</span>
        </li>
      ))}
    </ul>
  );
}
