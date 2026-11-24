import type { CallSummary } from "./unit";
import type { PauseRecord, RestRecord, SplitRecord, TimeReadRecord } from "./suites";

/**
 * The measures of the offline runs (#42). Machine measures come from the records; person measures
 * come from the scoring sheets and are null until every row is scored.
 */

const REPEAT_RULES = new Set(["repeat", "opening", "similar"]);
/** PAUSE-3: from the third Pause he says he is worried he may fail. */
const WORRIED = /\b(worr(?:y|ies|ied)|fail|failing|afraid)\b/i;
/** The pending escalation words of AI_03 A4 (report only; "still" is in it, as written there). */
const ESCALATION = /\b(worse|again|still|more and more|even)\b/i;

export type Measure = { value: number | null; count?: number; of?: number };

const rate = (count: number, of: number): Measure => ({
  value: of === 0 ? null : count / of,
  count,
  of,
});
const countOf = (count: number): Measure => ({ value: count, count });

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const firstRules = (call: CallSummary) => call.rulesByAttempt[0] ?? [];
const retried = (call: CallSummary) => call.attempts > 1;

export function pauseMeasures(records: PauseRecord[], arm: "on" | "off") {
  const mine = records.filter((record) => record.arm === arm);
  const calls = mine.flatMap((record) => record.calls);
  const shown = mine.filter((record) => record.status === "ok");
  const fromThird = shown.filter((record) => record.pause >= 3);
  const early = shown.filter((record) => record.pause <= 2);
  const firstHit = (rules: (rule: string) => boolean) =>
    mine.filter((record) => record.calls.some((call) => firstRules(call).some(rules))).length;
  const exactShown = mine.filter((record, index) =>
    mine.some(
      (other, at) =>
        at < index &&
        other.storyId === record.storyId &&
        other.run === record.run &&
        record.message !== undefined &&
        other.message === record.message,
    ),
  ).length;
  return {
    messages: countOf(mine.length),
    failure_rate: rate(mine.length - shown.length, mine.length),
    retry_rate: rate(calls.filter(retried).length, calls.length),
    repeat_first_attempt: rate(
      firstHit((rule) => REPEAT_RULES.has(rule)),
      mine.length,
    ),
    event_first_attempt: rate(
      firstHit((rule) => rule === "event"),
      mine.length,
    ),
    exact_repeat_shown: countOf(exactShown),
    worried_from_third: rate(
      fromThird.filter((record) => WORRIED.test(record.message ?? "")).length,
      fromThird.length,
    ),
    escalation_words_pause_1_2: rate(
      early.filter((record) => ESCALATION.test(`${record.story ?? ""} ${record.message ?? ""}`))
        .length,
      early.length,
    ),
    latency_p50: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        50,
      ),
    },
    latency_p95: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        95,
      ),
    },
  };
}

export function restMeasures(records: RestRecord[]) {
  const sent = records.filter((record) => record.status !== "keyword_stop");
  const shown = sent.filter((record) => record.status === "ok");
  const calls = sent.flatMap((record) => record.calls);
  return {
    replies: countOf(sent.length),
    keyword_stops: countOf(records.length - sent.length),
    failure_rate: rate(sent.length - shown.length, sent.length),
    retry_rate: rate(calls.filter(retried).length, calls.length),
    advising_first_attempt: rate(
      calls.filter((call) => firstRules(call).includes("cmd")).length,
      calls.length,
    ),
    leak_first_attempt: rate(
      calls.filter((call) => firstRules(call).includes("leak")).length,
      calls.length,
    ),
    leaks: countOf(shown.filter((record) => record.shownLeaks.length > 0).length),
    latency_p50: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        50,
      ),
    },
    latency_p95: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        95,
      ),
    },
  };
}

export function splitMeasures(records: SplitRecord[], times: TimeReadRecord[]) {
  const shown = records.filter((record) => record.status === "ok");
  const firstValid = records.filter(
    (record) => record.status === "ok" && record.calls[0]?.attempts === 1,
  );
  const stated = times.filter((time) => time.expectedMinutes !== null);
  const plain = times.filter((time) => time.expectedMinutes === null && !time.ambiguous);
  const byLine = new Map<string, number[]>();
  for (const record of shown) {
    byLine.set(record.lineId, [...(byLine.get(record.lineId) ?? []), record.stepCount ?? 0]);
  }
  const spreads = [...byLine.values()].map((counts) => Math.max(...counts) - Math.min(...counts));
  return {
    splits: countOf(records.length),
    valid_first_attempt: rate(firstValid.length, records.length),
    failure_rate: rate(records.length - shown.length, records.length),
    retry_rate: rate(
      records.filter((record) => record.calls[0]?.attempts > 1).length,
      records.length,
    ),
    time_ambiguous_wrong: countOf(
      times.filter((time) => time.ambiguous && time.foundMinutes !== null).length,
    ),
    time_stated_correct: rate(
      stated.filter((time) => time.foundMinutes === time.expectedMinutes).length,
      stated.length,
    ),
    time_false_reads: countOf(plain.filter((time) => time.foundMinutes !== null).length),
    step_count_spread_max: { value: spreads.length ? Math.max(...spreads) : null },
    latency_p50: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        50,
      ),
    },
    latency_p95: {
      value: percentile(
        shown.map((record) => record.latencyMs),
        95,
      ),
    },
  };
}

/** Valid first attempt per `kind` label (report only). */
export function splitByKind(records: SplitRecord[]): Record<string, Measure> {
  const kinds = [...new Set(records.map((record) => record.kind))].sort();
  return Object.fromEntries(
    kinds.map((kind) => {
      const mine = records.filter((record) => record.kind === kind);
      return [
        kind,
        rate(
          mine.filter((record) => record.status === "ok" && record.calls[0]?.attempts === 1).length,
          mine.length,
        ),
      ];
    }),
  );
}

export type ScoreRow = Record<string, string>;

const blank = (value: string | undefined) => (value ?? "").trim() === "";
const yes = (value: string | undefined) => /^(y|yes|1|true)$/i.test((value ?? "").trim());

/** Person measures from the scoring sheets; null while any row is unscored. */
export function personMeasures(sheets: { pause: ScoreRow[]; rest: ScoreRow[] }) {
  const { pause, rest } = sheets;
  const done = (rows: ScoreRow[], column: string) =>
    rows.length > 0 && rows.every((row) => !blank(row[column]));
  return {
    "pause.shown_event": done(pause, "event")
      ? countOf(pause.filter((row) => yes(row.event)).length)
      : null,
    "rest.relevance": done(rest, "relevance")
      ? rate(rest.filter((row) => Number(row.relevance) >= 4).length, rest.length)
      : null,
    "rest.in_character": done(rest, "in_character")
      ? rate(rest.filter((row) => yes(row.in_character)).length, rest.length)
      : null,
    "rest.advising_shown": done(rest, "advising")
      ? countOf(rest.filter((row) => yes(row.advising)).length)
      : null,
  } as Record<string, Measure | null>;
}
