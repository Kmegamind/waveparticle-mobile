"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { postRun, type RunReply } from "@/lib/ai-runs/client";
import {
  answersLocked,
  comparisonWrite,
  defaultSides,
  hiddenModelLabel,
  hiddenNow,
  LAB_SAVE_PROBLEMS,
  setAnswer,
  sideOptions,
  sideOrder,
  sideRequest,
  sideVariables,
  withSideReply,
  type AnswerState,
  type LabModelName,
  type LabSide,
  type LabPrompt,
  type PassAnswer,
  type SideChoice,
} from "@/lib/ai-runs/comparison";
import { modelErrorText, RUN_REFUSED } from "@/lib/ai-runs/panel";
import { emptyProblems, unfilledVariables } from "@/lib/ai-samples/variables";
import { saveComparisonAction } from "./actions";

// #478 (FR-AILAB-4, FR-AILAB-5; AI-LAB-SAMPLES, AI-LAB-STUB): the comparison lab, as the drawing
// docs/design/prototype/admin-ai-features.html (#reg-lab, AIR-4). The settings panel (feature,
// sample, side A, side B, Blind, Run both), then the two answers side by side, each with the
// feature's pass questions to answer yes or no, then Save result. Run both posts each side to the
// Run route through the shared client (src/lib/ai-runs/client.ts), at the same time and with the
// same sample, so each side is an ordinary recorded run. Blind shows the sides in a random order
// as "Side 1" and "Side 2" until every pass question of both sides is answered.

export type LabFeature = {
  slug: string;
  id: string;
  name: string;
  questions: string[];
  prompts: LabPrompt[];
};

/** A sample of the library, with the {{variables}} it leaves empty. */
export type LabSample = { id: string; name: string; empty: string[] };

type Side = LabSide;

type SideResult = {
  choice: SideChoice;
  label: string;
  reply: RunReply | null;
  /** The run of this side's answer; null while it runs or when it has no answer. */
  runId: string | null;
  answers: PassAnswer[];
};

/** The answers are kept by side, not by panel (AnswerState, src/lib/ai-runs/comparison.ts). */
type Comparison = AnswerState & {
  feature: string;
  key: string;
  sample: string;
  questions: string[];
  a: SideResult;
  b: SideResult;
};

/** A side's reply: its run id, fresh answers for it, the other side's answers kept. */
function applyReply(current: Comparison, side: Side, reply: RunReply): Comparison {
  const next = withSideReply(current, side, reply.kind === "answer" ? reply.answer.runId : null);
  return { ...next, [side]: { ...next[side], reply } };
}

/** Whether a side ran on the stub, when its reply says so. */
function stubOf(result: SideResult): boolean {
  const reply = result.reply;
  if (reply?.kind === "answer") return reply.answer.stub;
  if (reply?.kind === "model-error") return reply.stub;
  return false;
}

const SAMPLE_NONE = "";
const noSubscription = () => () => {};

export function ComparisonLab({
  features,
  firstFeature,
  samples,
  models,
  writer,
}: {
  features: LabFeature[];
  firstFeature: string;
  samples: LabSample[] | null;
  models: LabModelName[];
  writer: boolean;
}) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const startFeature = features.find((item) => item.slug === firstFeature) ?? features[0];
  const startPrompt = startFeature.prompts[0];
  const [featureSlug, setFeatureSlug] = useState(startFeature.slug);
  const [key, setKey] = useState(startPrompt?.key ?? "");
  const [sample, setSample] = useState(samples?.[0]?.id ?? SAMPLE_NONE);
  const [sides, setSides] = useState(() =>
    startPrompt ? defaultSides(startPrompt, models) : { a: "", b: "" },
  );
  const [blind, setBlind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, startSaving] = useTransition();

  const feature = features.find((item) => item.slug === featureSlug) ?? startFeature;
  const prompt = feature.prompts.find((item) => item.key === key) ?? feature.prompts[0];
  const options = prompt ? sideOptions(prompt, models) : [];
  const labelOf = (choice: SideChoice) =>
    options.find((item) => item.value === choice)?.label ?? choice;

  const choose = (nextFeature: LabFeature, nextKey?: string) => {
    const nextPrompt =
      nextFeature.prompts.find((item) => item.key === nextKey) ?? nextFeature.prompts[0];
    setFeatureSlug(nextFeature.slug);
    setKey(nextPrompt?.key ?? "");
    setSides(nextPrompt ? defaultSides(nextPrompt, models) : { a: "", b: "" });
    setComparison(null);
    setMessage("");
  };

  // The variables a side's version uses that the sample does not fill, or leaves empty: the
  // route refuses that side before the model is called (docs/decisions/0037), so say it first.
  const warnings: string[] = [];
  if (prompt && sample !== SAMPLE_NONE) {
    const empty = samples?.find((item) => item.id === sample)?.empty ?? [];
    for (const side of ["a", "b"] as const) {
      const names = sideVariables(prompt, sides[side]);
      const unfilled = unfilledVariables(names);
      const blank = names.filter((name) => empty.includes(name));
      const problems = [
        ...(unfilled.length > 0
          ? [`A sample does not fill ${unfilled.map((name) => `{{${name}}}`).join(", ")}.`]
          : []),
        ...(blank.length > 0 ? emptyProblems(blank) : []),
      ];
      if (problems.length > 0) {
        warnings.push(`Side ${side.toUpperCase()}: ${problems.join(" ")}`);
      }
    }
  }

  const requests = {
    a: prompt
      ? sideRequest({
          feature: feature.slug,
          prompt,
          choice: sides.a,
          sample: sample || null,
          models,
        })
      : null,
    b: prompt
      ? sideRequest({
          feature: feature.slug,
          prompt,
          choice: sides.b,
          sample: sample || null,
          models,
        })
      : null,
  };
  const canRun = ready && !busy && !!requests.a && !!requests.b;

  async function runBoth() {
    if (!requests.a || !requests.b || !prompt) return;
    const order = sideOrder(blind);
    const start = (choice: SideChoice): SideResult => ({
      choice,
      label: labelOf(choice),
      reply: null,
      runId: null,
      answers: feature.questions.map(() => null),
    });
    setComparison({
      feature: feature.slug,
      key: prompt.key,
      sample,
      questions: feature.questions,
      blind,
      peeked: false,
      order,
      a: start(sides.a),
      b: start(sides.b),
    });
    setSaved(false);
    setMessage("");
    setBusy(true);
    const [a, b] = await Promise.all([postRun(requests.a), postRun(requests.b)]);
    setBusy(false);
    setComparison((current) => current && applyReply(applyReply(current, "a", a), "b", b));
  }

  async function retry(side: Side) {
    if (!comparison) return;
    const chosenPrompt = feature.prompts.find((item) => item.key === comparison.key);
    const request = chosenPrompt
      ? sideRequest({
          feature: comparison.feature,
          prompt: chosenPrompt,
          choice: comparison[side].choice,
          sample: comparison.sample || null,
          models,
        })
      : null;
    if (!request) return;
    // Functional updates only: answers given on the other side while this one runs are kept.
    setComparison(
      (current) =>
        current && { ...current, [side]: { ...current[side], reply: null, runId: null } },
    );
    setBusy(true);
    const reply = await postRun(request);
    setBusy(false);
    setComparison((current) => current && applyReply(current, side, reply));
  }

  const answer = (side: Side, index: number, value: boolean) => {
    setComparison((current) => current && setAnswer(current, side, index, value));
  };

  const count = comparison?.questions.length ?? 0;
  const hidden =
    !!comparison && comparison.blind && blind && count > 0
      ? hiddenNow(true, comparison.a.answers, comparison.b.answers)
      : false;
  // A blind comparison whose names are shown: the answers can no longer change.
  const locked = comparison ? answersLocked(comparison) : false;
  const modelLine = comparison
    ? hiddenModelLabel(hidden, stubOf(comparison.a), stubOf(comparison.b))
    : "shown";
  const recorded = (side: Side) => {
    const reply = comparison?.[side].reply;
    return reply?.kind === "answer" && reply.answer.recorded;
  };
  const write = comparison ? comparisonWrite(comparison) : null;
  const canSave = ready && !busy && !saving && !saved && !!write && recorded("a") && recorded("b");

  function save() {
    if (!write) return;
    setMessage("");
    startSaving(async () => {
      const result = await saveComparisonAction(write).catch(
        () => ({ ok: false, error: "failed" }) as const,
      );
      if (!result.ok) {
        setMessage(LAB_SAVE_PROBLEMS[result.error]);
        return;
      }
      setSaved(true);
      setMessage("Result saved with both runs.");
    });
  }

  const sideTitle = (side: Side, position: number) =>
    hidden ? `Side ${position}` : `Side ${side.toUpperCase()} · ${comparison?.[side].label ?? ""}`;

  return (
    <>
      <section aria-label="Comparison settings" className="admin-panel admin-lab-form">
        <div className="admin-grid2">
          <div className="admin-form">
            <label>
              Feature
              <select
                className="admin-text-field"
                disabled={busy}
                onChange={(event) => {
                  const next = features.find((item) => item.slug === event.target.value);
                  if (next) choose(next);
                }}
                value={feature.slug}
              >
                {features.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.id ? `${item.id} ${item.name}` : item.name}
                  </option>
                ))}
              </select>
            </label>
            {feature.prompts.length > 1 ? (
              <label>
                Prompt
                <select
                  className="admin-text-field"
                  disabled={busy}
                  onChange={(event) => choose(feature, event.target.value)}
                  value={prompt?.key ?? ""}
                >
                  {feature.prompts.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Sample (the same for both sides)
              <select
                className="admin-text-field"
                disabled={busy}
                onChange={(event) => {
                  setSample(event.target.value);
                  setComparison(null);
                  setMessage("");
                }}
                value={sample}
              >
                {(samples ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value={SAMPLE_NONE}>No sample (the prompt as written)</option>
              </select>
            </label>
          </div>
          <div className="admin-form">
            {(["a", "b"] as const).map((side) => (
              <label key={side}>
                Side {side.toUpperCase()}
                <select
                  className="admin-text-field"
                  disabled={busy || options.length === 0}
                  onChange={(event) =>
                    setSides((current) => ({ ...current, [side]: event.target.value }))
                  }
                  value={sides[side]}
                >
                  {options.length === 0 ? (
                    <option value="">No prompt version or model to run</option>
                  ) : (
                    options.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ))}
          </div>
        </div>
        {samples === null ? (
          <p className="admin-note admin-lab-warning" role="alert">
            The sample library could not be read. You can still run the prompt as written.
          </p>
        ) : null}
        {models.length === 0 ? (
          <p className="admin-note admin-lab-warning" role="alert">
            No model is configured on the server.
          </p>
        ) : null}
        {warnings.map((text) => (
          <p className="admin-note admin-lab-warning" key={text} role="note">
            {text} That side stops before the model is called.
          </p>
        ))}
        <div className="admin-lab-actions">
          <label className="admin-check">
            <input
              checked={blind}
              disabled={busy}
              onChange={(event) => {
                // Names shown before every answer: the comparison is saved as not blind.
                if (!event.target.checked && hidden) {
                  setComparison((current) => current && { ...current, peeked: true });
                }
                setBlind(event.target.checked);
              }}
              type="checkbox"
            />{" "}
            Blind: hide which side is which until the pass questions are answered
          </label>
          <button
            className="button-filled"
            disabled={!canRun}
            onClick={() => void runBoth()}
            type="button"
          >
            {busy ? "Running…" : "Run both"}
          </button>
        </div>
      </section>

      {comparison === null ? (
        <p className="admin-empty">No runs yet</p>
      ) : (
        <>
          <div className="admin-cmp admin-lab-cmp">
            {comparison.order.map((side, index) => {
              const title = sideTitle(side, index + 1);
              const result = comparison[side];
              const reply = result.reply;
              return (
                <section aria-label={title} className="admin-panel admin-lab-side" key={side}>
                  <h2>
                    {title}{" "}
                    {hidden ? (
                      <span className="admin-pill admin-pill-draft">Hidden until answered</span>
                    ) : null}
                  </h2>
                  {reply === null ? (
                    <div aria-busy="true" role="status">
                      <p className="admin-run-progress">
                        <span className="admin-pill admin-pill-running">Run in progress</span>{" "}
                        {hidden ? title : result.label} · started by you
                      </p>
                      <div className="admin-run-bar">
                        <i />
                      </div>
                    </div>
                  ) : reply.kind === "model-error" ? (
                    <p className="admin-errbox" role="alert">
                      <span>
                        <b>The model did not answer.</b> {modelErrorText(reply.reason)}{" "}
                        {reply.recorded
                          ? "The run is recorded as a model error."
                          : "The end of this run was not recorded: Runs shows it as not ended."}
                      </span>
                      <button
                        className="button-gray button-small"
                        disabled={!ready || busy}
                        onClick={() => void retry(side)}
                        type="button"
                      >
                        Retry
                      </button>
                    </p>
                  ) : reply.kind === "refused" ? (
                    <div className="admin-errbox" role="alert">
                      <span>
                        <b>{RUN_REFUSED[reply.error] ?? RUN_REFUSED.failed}</b>
                        {reply.problems.length > 0 ? <> {reply.problems.join(" ")}</> : null}
                      </span>
                      <button
                        className="button-gray button-small"
                        disabled={!ready || busy}
                        onClick={() => void retry(side)}
                        type="button"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {reply.answer.recorded ? null : (
                        <p className="admin-errbox" role="alert">
                          <span>
                            <b>The end of this run was not recorded.</b> Its answers cannot be
                            saved.
                          </span>
                        </p>
                      )}
                      <p className="admin-lab-model">
                        {modelLine === "hidden" ? (
                          // The sides differ (stub and a real model): one neutral line on both.
                          <span className="admin-note">Model hidden until answered</span>
                        ) : reply.answer.stub ? (
                          <span className="admin-pill admin-pill-mark">Fake model (stub)</span>
                        ) : (
                          <span className="admin-note">Model: {reply.answer.model}</span>
                        )}
                      </p>
                      <pre aria-label="Answer" className="admin-code">
                        {reply.answer.output}
                      </pre>
                      <div>
                        <p className="admin-note admin-lab-questions">
                          {comparison.questions.length === 0
                            ? "This feature has no pass questions yet. Write them on its feature page (Pass standard) to answer and save a comparison."
                            : locked
                              ? "Pass questions (yes or no). The sides are shown, so the answers are locked: they were given blind."
                              : "Pass questions (yes or no)."}
                        </p>
                        {comparison.questions.map((question, i) => (
                          <div className="admin-yn" key={`${i}-${question}`}>
                            <span>{question}</span>
                            <div
                              aria-label={`${title}, question ${i + 1}`}
                              className="admin-seg"
                              role="group"
                            >
                              {(
                                [
                                  [true, "Yes"],
                                  [false, "No"],
                                ] as const
                              ).map(([value, word]) => (
                                <button
                                  aria-pressed={result.answers[i] === value}
                                  className="button-gray button-small"
                                  disabled={saved || locked || !ready}
                                  key={word}
                                  onClick={() => answer(side, i, value)}
                                  type="button"
                                >
                                  {word}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              );
            })}
          </div>
          <div className="admin-lab-save">
            <button className="button-filled" disabled={!canSave} onClick={save} type="button">
              Save result
            </button>
          </div>
          {message ? (
            <p className="admin-note admin-lab-message" role="status">
              {message}
            </p>
          ) : null}
        </>
      )}
      <p className="admin-note admin-lab-after">
        Save result waits until both sides have an answer and every pass question has yes or no. The
        answers are saved with both runs.
        {writer ? " A writer uses the lab like an admin." : ""}
      </p>
    </>
  );
}
