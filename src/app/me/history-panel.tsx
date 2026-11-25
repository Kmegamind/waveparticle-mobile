"use client";

import Link from "next/link";
import { useState } from "react";
import type { HistoryEntry } from "@/lib/me/me-view";

/**
 * ME-CAL (#82): the days on which the user worked, as a month calendar or a list. Only days with
 * a session carry a dot and can be chosen; empty days draw nothing. No crosses, gaps, lines,
 * totals, shading or counts. The chosen view is remembered on this device.
 */

const VIEW_KEY = "waveparticle.history-view";
type HistoryView = "calendar" | "list";

type Day = { day: number; sessions: HistoryEntry[] };

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

/** The month that holds `anchorIso`, with a leading gap so the 1st falls on its weekday. */
export function calendarMonth(history: HistoryEntry[], anchorIso: string) {
  const anchor = new Date(anchorIso);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const length = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const days: (Day | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= length; day += 1) {
    const key = dayKey(new Date(year, month, day));
    days.push({
      day,
      sessions: history.filter((entry) => dayKey(new Date(entry.firstDoneAt)) === key),
    });
  }
  const label = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { label, monthName: label.split(" ")[0], days };
}

function readView(): HistoryView | null {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    return stored === "calendar" || stored === "list" ? stored : null;
  } catch {
    return null;
  }
}

function Rows({ sessions }: { sessions: HistoryEntry[] }) {
  return (
    <ul className="me-rows">
      {sessions.map((entry) => (
        <li key={entry.sessionId}>
          <Link className="me-row-link" href={`/me/history/${encodeURIComponent(entry.sessionId)}`}>
            <span className="me-row-goal">{entry.goalTitle}</span>
            <span className="me-row-meta">
              {entry.companion
                ? `${entry.companion} · ${entry.minutes} min`
                : `${entry.minutes} min`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function HistoryPanel({
  history,
  initialView,
}: {
  history: HistoryEntry[];
  initialView?: HistoryView;
}) {
  const [view, setView] = useState<HistoryView>(
    () => initialView ?? (typeof window === "undefined" ? null : readView()) ?? "calendar",
  );
  // Months that have a session, newest first; the calendar opens on the newest.
  const months = [...new Set(history.map((entry) => monthKey(new Date(entry.firstDoneAt))))];
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  function choose(next: HistoryView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered on this device; the view still changes.
    }
  }

  if (history.length === 0) {
    return <p className="me-quiet">Your sessions will show here.</p>;
  }

  const anchor =
    history.find((entry) => monthKey(new Date(entry.firstDoneAt)) === months[monthIndex])
      ?.firstDoneAt ?? history[0].firstDoneAt;
  const month = calendarMonth(history, anchor);
  const chosen = selected === null ? null : month.days.find((day) => day?.day === selected);

  const byDay = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const key = dayKey(new Date(entry.firstDoneAt));
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  return (
    <div className="me-history">
      <div className="me-segmented" role="group" aria-label="History view">
        {(["calendar", "list"] as const).map((option) => (
          <button
            aria-pressed={view === option}
            className="me-segment"
            key={option}
            onClick={() => choose(option)}
            type="button"
          >
            {option === "calendar" ? "Calendar" : "List"}
          </button>
        ))}
      </div>
      {view === "calendar" ? (
        <>
          <div className="me-month">
            <p className="me-month-name">{month.monthName}</p>
            {months.length > 1 ? (
              <span className="me-month-nav">
                <button
                  aria-label="Earlier month"
                  className="button-plain button-small"
                  disabled={monthIndex >= months.length - 1}
                  onClick={() => {
                    setMonthIndex(monthIndex + 1);
                    setSelected(null);
                  }}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Later month"
                  className="button-plain button-small"
                  disabled={monthIndex === 0}
                  onClick={() => {
                    setMonthIndex(monthIndex - 1);
                    setSelected(null);
                  }}
                  type="button"
                >
                  ›
                </button>
              </span>
            ) : null}
          </div>
          <div aria-label={month.label} className="me-calendar" role="group">
            {["S", "M", "T", "W", "T", "F", "S"].map((letter, index) => (
              <span aria-hidden="true" className="me-weekday" key={`${letter}-${index}`}>
                {letter}
              </span>
            ))}
            {month.days.map((day, index) =>
              day === null ? (
                <span aria-hidden="true" className="me-day-gap" key={`gap-${index}`} />
              ) : day.sessions.length > 0 ? (
                <button
                  aria-label={`${month.monthName} ${day.day}, worked`}
                  aria-pressed={selected === day.day}
                  className="me-day me-day-marked"
                  key={day.day}
                  onClick={() => setSelected(selected === day.day ? null : day.day)}
                  type="button"
                >
                  {day.day}
                  <span aria-hidden="true" className="me-dot" />
                </button>
              ) : (
                <span className="me-day me-day-quiet" key={day.day}>
                  {day.day}
                </span>
              ),
            )}
          </div>
          {chosen && chosen.sessions.length > 0 ? <Rows sessions={chosen.sessions} /> : null}
        </>
      ) : (
        <ol className="me-list">
          {[...byDay.values()].map((sessions) => (
            <li key={sessions[0].sessionId}>
              <h3 className="focus-label">{dayLabel(sessions[0].firstDoneAt)}</h3>
              <Rows sessions={sessions} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
