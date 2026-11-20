"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  SHOW_FIRST,
  filterHistory,
  goalsLists,
  historyGoals,
  matchesSearch,
  type GoalRow,
  type GoalStatus,
  type GoalsData,
  type GoalsTab,
  type HistoryRange,
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

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

const EPOCH = { now: new Date(0), timeZone: "UTC" };

/** After a change or Undo, keyboard focus goes to the selected tab: the row may have moved away. */
const selectedTab = () =>
  document.querySelector<HTMLElement>('.goals-tabs [role="tab"][aria-selected="true"]');

export function GoalsScreen({ data, initialTab }: { data: GoalsData; initialTab: GoalsTab }) {
  const router = useRouter();
  const local = useLocalNow();
  const [tab, setTab] = useState<GoalsTab>(initialTab);
  const [query, setQuery] = useState("");
  // History filters (#112, G6): one Goal or all, and a time range.
  const [historyGoal, setHistoryGoal] = useState("");
  const [range, setRange] = useState<HistoryRange>("all");
  const [showAll, setShowAll] = useState(false);
  const [menu, setMenu] = useState<{
    goalId: string;
    status: GoalStatus;
    opener: HTMLElement | null;
  } | null>(null);
  const [newGoal, setNewGoal] = useState<{
    draft: string;
    opened: number;
    opener: HTMLElement | null;
  } | null>(null);
  const [openings, setOpenings] = useState(0);
  const openNewGoal = (event: { currentTarget: HTMLElement }) => {
    setOpenings((count) => count + 1);
    setNewGoal({ draft: keptDraft(), opened: openings + 1, opener: event.currentTarget });
  };
  const { toast, busy, change, undo, close } = useGoalChanges(selectedTab);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const lists = useMemo(() => goalsLists(data, local ?? EPOCH), [data, local]);
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
    if (filtered.length === 0) return <Empty tab={tab} query={query} onNew={openNewGoal} />;
    const shown = grouped && !showAll ? filtered.slice(0, SHOW_FIRST) : filtered;
    const render = (row: GoalRow) => (
      <Row
        busy={busy}
        key={row.id}
        onChange={(kind) => void change(kind, row.id)}
        onMenu={(opener) => setMenu({ goalId: row.id, status: row.status, opener })}
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

  return (
    <main className="app-screen goals-page" data-ready={ready ? "true" : "false"}>
      <div className="goals-head">
        <h1>Goals</h1>
        <button
          aria-label="New goal"
          className="button-gray button-small"
          onClick={openNewGoal}
          type="button"
        >
          + New goal
        </button>
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
      {tab === "history" && lists.history.length > 0 ? (
        <div className="goals-filters">
          <label className="goals-filter">
            <span>Goal</span>
            <select onChange={(event) => setHistoryGoal(event.target.value)} value={historyGoal}>
              <option value="">All Goals</option>
              {historyGoals(lists.history).map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="goals-filter">
            <span>Time</span>
            <select
              onChange={(event) => setRange(event.target.value as HistoryRange)}
              value={range}
            >
              {RANGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
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
            filtered={query.trim() !== "" || historyGoal !== "" || range !== "all"}
            ready={ready}
            rows={filterHistory(
              lists.history.filter((row) => matchesSearch(query, row.goalTitle)),
              { goalId: historyGoal || null, range },
              local ?? EPOCH,
            )}
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
        returnTo={menu?.opener ?? null}
        status={menu?.status ?? null}
      />
      <NewGoalSheet
        initialDraft={newGoal?.draft ?? ""}
        key={newGoal?.opened ?? 0}
        onClose={() => setNewGoal(null)}
        open={newGoal !== null}
        returnTo={newGoal?.opener ?? null}
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
  onMenu: (opener: HTMLElement) => void;
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
        onClick={(event) => onMenu(event.currentTarget)}
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
  onNew: (event: { currentTarget: HTMLElement }) => void;
}) {
  if (query.trim()) return <p className="goals-empty">No matches.</p>;
  return (
    <p className="goals-empty">
      {EMPTY[tab]}
      {tab === "progress" ? (
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

function History({
  rows,
  filtered,
  ready,
}: {
  rows: HistoryRow[];
  /** A search or a filter is on: an empty list then reads "No matches." (#112 AC3). */
  filtered: boolean;
  ready: boolean;
}) {
  if (rows.length === 0) {
    return <p className="goals-empty">{filtered ? "No matches." : EMPTY.history}</p>;
  }
  return <HistoryList ready={ready} rows={rows} />;
}

export function HistoryList({
  rows,
  ready,
  withGoal = true,
}: {
  rows: HistoryRow[];
  ready: boolean;
  /** The Goal's name follows the date on History; the Goal detail's own list leaves it out. */
  withGoal?: boolean;
}) {
  return (
    <ul className="goals-history">
      {rows.map((row) => (
        <li key={row.sessionId}>
          <span className="goals-history-main">
            <span className="goals-history-title">
              {withGoal ? (
                <>
                  {ready ? `${row.date} · ` : ""}
                  {row.goalTitle}
                </>
              ) : ready ? (
                row.date
              ) : null}
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
