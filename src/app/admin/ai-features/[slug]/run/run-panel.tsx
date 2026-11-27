"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import type { ExampleState } from "@/lib/ai-features/registry-filter";
import {
  costText,
  modelErrorText,
  RUN_REFUSED,
  tokensText,
  versionLabel,
  type PromptSource,
} from "@/lib/ai-runs/panel";
import {
  emptyProblems,
  promptVariables,
  SAMPLE_VARIABLE_NAMES,
  unfilledVariables,
} from "@/lib/ai-samples/variables";
import { setRunExampleAction } from "../../../ai-runs/actions";
import { WRITE_PROBLEMS } from "../../sections-editor";

// #477 (FR-AILAB-1, FR-AILAB-3, FR-AILAB-6; AI-RUN-PERMISSION, AI-LAB-STUB; docs/decisions/0037):
// the Run panel, as the drawing docs/design/prototype/admin-ai-features.html (#reg-run, AIR-3).
// Run settings on the left (prompt version: published, draft or pasted text; sample; model), the
// answer on the right (the stub marker when the fake model ran, the checks that apply, tokens,
// cost, then Set as candidate example and Confirm). Run posts to POST /admin/ai-runs/run (#476),
// which checks the account again, records the run before the model call and keeps the model key
// on the server. In progress, the panel says so; a model error or a refused run shows an error box
// with Retry; a run whose end the database did not record says so in an alert, never quietly.

export type PanelPrompt = {
  key: string;
  published: { version: number; body: string } | null;
  draft: { version: number; body: string } | null;
};

/** A sample of the library, with the {{variables}} it leaves empty (src/lib/ai-samples/variables.ts). */
export type PanelSample = { id: string; name: string; empty: string[] };

type Settings = {
  key: string;
  source: PromptSource;
  pasted: string;
  sample: string;
};

type Answer = {
  ok: true;
  runId: string;
  recorded: boolean;
  output: string;
  checks:
    { applied: true; passed: boolean; failedRules: string[] } | { applied: false; note: string };
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  costNote: string | null;
  stub: boolean;
  model: string;
  promptVersion: number | null;
};

type Outcome =
  | { kind: "answer"; answer: Answer; settings: Settings }
  | {
      kind: "model-error";
      reason: string;
      recorded: boolean;
      stub: boolean;
      settings: Settings;
    }
  | { kind: "refused"; error: string; problems: string[]; settings: Settings };

const noSubscription = () => () => {};

const SAMPLE_NONE = "";

export function RunPanel({
  slug,
  prompts,
  samples,
  model,
  spendLine,
  exampleSetAt,
  exampleState,
  writer,
}: {
  slug: string;
  prompts: PanelPrompt[];
  samples: PanelSample[] | null;
  model: { name: string; stub: boolean } | null;
  spendLine: string;
  exampleSetAt: string | null;
  exampleState: ExampleState;
  writer: boolean;
}) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const firstKey = prompts[0]?.key ?? "";
  const firstPrompt = prompts[0];
  const [settings, setSettings] = useState<Settings>({
    key: firstKey,
    source: firstPrompt?.published ? "published" : firstPrompt?.draft ? "draft" : "pasted",
    pasted: "",
    sample: samples?.[0]?.id ?? SAMPLE_NONE,
  });
  const [running, setRunning] = useState<Settings | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [example, setExample] = useState<{ setAt: string | null; state: ExampleState }>({
    setAt: exampleSetAt,
    state: exampleState,
  });
  const [exampleMessage, setExampleMessage] = useState("");
  const [examplePending, startExample] = useTransition();

  const prompt = prompts.find((item) => item.key === settings.key) ?? firstPrompt;
  const body =
    settings.source === "pasted"
      ? settings.pasted
      : settings.source === "draft"
        ? (prompt?.draft?.body ?? "")
        : (prompt?.published?.body ?? "");
  const unfilled = settings.sample === SAMPLE_NONE ? [] : unfilledVariables(promptVariables(body));
  const sampleEmpty = samples?.find((item) => item.id === settings.sample)?.empty ?? [];
  const emptyHere =
    settings.sample === SAMPLE_NONE
      ? []
      : promptVariables(body).filter((name) => sampleEmpty.includes(name));
  const sourceReady =
    settings.source === "pasted"
      ? settings.pasted.trim() !== ""
      : settings.source === "draft"
        ? !!prompt?.draft
        : !!prompt?.published;
  const busy = running !== null;
  const canRun = ready && !busy && !!model && !!prompt && sourceReady;

  const sampleName = (id: string) =>
    id === SAMPLE_NONE ? "No sample" : (samples?.find((item) => item.id === id)?.name ?? id);
  const versionOf = (chosen: Settings) => {
    const row = prompts.find((item) => item.key === chosen.key);
    const version =
      chosen.source === "draft"
        ? (row?.draft?.version ?? null)
        : chosen.source === "published"
          ? (row?.published?.version ?? null)
          : null;
    return versionLabel(chosen.source, version);
  };
  const runTitle = (chosen: Settings) =>
    `${versionOf(chosen)}${prompts.length > 1 ? ` of ${chosen.key}` : ""} on ${sampleName(
      chosen.sample,
    )}`;

  async function run(chosen: Settings) {
    if (!model) return;
    const row = prompts.find((item) => item.key === chosen.key);
    const request = {
      feature: slug,
      promptKey: chosen.key,
      prompt:
        chosen.source === "pasted"
          ? { source: "pasted", text: chosen.pasted }
          : chosen.source === "draft"
            ? { source: "draft", version: row?.draft?.version ?? 0 }
            : { source: "published" },
      sample: chosen.sample === SAMPLE_NONE ? null : chosen.sample,
      model: model.name,
    };
    setRunning(chosen);
    setOutcome(null);
    setExampleMessage("");
    let next: Outcome;
    try {
      const response = await fetch("/admin/ai-runs/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (result?.ok === true) {
        next = { kind: "answer", answer: result as unknown as Answer, settings: chosen };
      } else if (result?.error === "model-error") {
        next = {
          kind: "model-error",
          reason: String(result.reason ?? "request"),
          recorded: result.recorded !== false,
          stub: result.stub === true,
          settings: chosen,
        };
      } else {
        next = {
          kind: "refused",
          error: typeof result?.error === "string" ? result.error : "failed",
          problems: Array.isArray(result?.problems) ? result.problems.map(String) : [],
          settings: chosen,
        };
      }
    } catch {
      next = { kind: "refused", error: "network", problems: [], settings: chosen };
    }
    setRunning(null);
    setOutcome(next);
  }

  function saveExample(answer: Answer, state: "candidate" | "confirmed") {
    setExampleMessage("");
    startExample(async () => {
      const result = await setRunExampleAction({
        slug,
        runId: answer.runId,
        state,
        loadedAt: example.setAt,
      }).catch(() => ({ ok: false, error: "failed" }) as const);
      if (!result.ok) {
        setExampleMessage(WRITE_PROBLEMS[result.error]);
        return;
      }
      setExample({ setAt: result.savedAt ?? null, state });
      setExampleMessage(
        state === "candidate"
          ? "Set as the candidate example."
          : "Confirmed as the example. The earlier example stays in history.",
      );
    });
  }

  const retry = (chosen: Settings) => (
    <button
      className="button-gray button-small"
      disabled={!ready || busy}
      onClick={() => void run(chosen)}
      type="button"
    >
      Retry
    </button>
  );

  return (
    <>
      <div className="admin-grid2 admin-run">
        <section aria-labelledby="run-settings" className="admin-panel">
          <h2 id="run-settings">Run settings</h2>
          <form
            aria-label="Run settings"
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canRun) void run(settings);
            }}
          >
            {prompts.length > 1 ? (
              <label>
                Prompt
                <select
                  className="admin-text-field"
                  disabled={busy}
                  onChange={(event) => {
                    const key = event.target.value;
                    const next = prompts.find((item) => item.key === key);
                    setSettings((current) => ({
                      ...current,
                      key,
                      source:
                        current.source === "pasted"
                          ? "pasted"
                          : current.source === "draft" && next?.draft
                            ? "draft"
                            : next?.published
                              ? "published"
                              : next?.draft
                                ? "draft"
                                : "pasted",
                    }));
                  }}
                  value={settings.key}
                >
                  {prompts.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="admin-field-group">
              <span id="run-version">Prompt version</span>
              <div aria-labelledby="run-version" className="admin-seg" role="group">
                {(
                  [
                    ["published", "Published", !!prompt?.published],
                    ["draft", "Draft", !!prompt?.draft],
                    ["pasted", "Pasted text", true],
                  ] as const
                ).map(([source, label, offered]) => (
                  <button
                    aria-pressed={settings.source === source}
                    className="button-gray"
                    disabled={!offered || busy}
                    key={source}
                    onClick={() => setSettings((current) => ({ ...current, source }))}
                    title={offered ? undefined : `No ${label.toLowerCase()} version of this prompt`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Pasted text (only with Pasted text)
              <textarea
                className="admin-text-field"
                disabled={settings.source !== "pasted" || busy}
                maxLength={20_000}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, pasted: event.target.value }))
                }
                placeholder="Paste a prompt to try. It is not saved as a version."
                value={settings.pasted}
              />
            </label>
            <label>
              Sample
              <select
                className="admin-text-field"
                disabled={busy}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, sample: event.target.value }))
                }
                value={settings.sample}
              >
                {(samples ?? []).map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.name}
                  </option>
                ))}
                <option value={SAMPLE_NONE}>No sample (the prompt as written)</option>
              </select>
            </label>
            {samples === null ? (
              <p className="admin-note" role="alert">
                The sample library could not be read. You can still run the prompt as written.
              </p>
            ) : null}
            {unfilled.length > 0 ? (
              <p className="admin-note" role="note">
                A sample does not fill {unfilled.map((name) => `{{${name}}}`).join(", ")}: the run
                stops before the model is called. A sample fills{" "}
                {SAMPLE_VARIABLE_NAMES.map((name) => `{{${name}}}`).join(", ")}.
              </p>
            ) : null}
            {emptyHere.length > 0 ? (
              <p className="admin-note admin-run-empty" role="note">
                {emptyProblems(emptyHere).join(" ")} The run stops before the model is called.
              </p>
            ) : null}
            <label>
              Model
              <select
                className="admin-text-field"
                defaultValue={model?.name ?? ""}
                disabled={!model || busy}
              >
                {model ? (
                  <option value={model.name}>
                    {model.stub ? `Stub model (fake, no charge): ${model.name}` : model.name}
                  </option>
                ) : (
                  <option value="">No model configured</option>
                )}
              </select>
            </label>
            <div>
              <button className="button-filled" disabled={!canRun} type="submit">
                {busy ? "Running…" : "Run"}
              </button>
            </div>
            <p className="admin-note admin-run-spend">{spendLine}</p>
          </form>
        </section>

        <section aria-labelledby="run-answer" aria-live="polite" className="admin-panel">
          <h2 id="run-answer">Answer</h2>
          {running ? (
            <div aria-busy="true" role="status">
              <p className="admin-run-progress">
                <span className="admin-pill admin-pill-running">Run in progress</span>{" "}
                {runTitle(running)} · started by you
                {model?.stub ? (
                  <>
                    {" · "}
                    <span className="admin-pill admin-pill-mark">Fake model (stub)</span>
                  </>
                ) : null}
              </p>
              <div className="admin-run-bar">
                <i />
              </div>
              <p className="admin-src">
                The run is recorded before the model is called. It can take up to two minutes.
              </p>
            </div>
          ) : outcome === null ? (
            <p className="admin-empty">No runs yet</p>
          ) : outcome.kind === "model-error" ? (
            <>
              <p className="admin-errbox" role="alert">
                <span>
                  <b>The model did not answer.</b> {modelErrorText(outcome.reason)}{" "}
                  {outcome.recorded
                    ? "The run is recorded as a model error."
                    : "The end of this run was not recorded: Runs shows it as not ended."}
                </span>
                {retry(outcome.settings)}
              </p>
              {outcome.stub ? (
                <p className="admin-src">
                  <span className="admin-pill admin-pill-mark">Fake model (stub)</span>
                </p>
              ) : null}
            </>
          ) : outcome.kind === "refused" ? (
            <div className="admin-errbox" role="alert">
              <span>
                <b>{RUN_REFUSED[outcome.error] ?? RUN_REFUSED.failed}</b>
                {outcome.problems.length > 0 ? <> {outcome.problems.join(" ")}</> : null}
              </span>
              {retry(outcome.settings)}
            </div>
          ) : (
            <AnswerView
              answer={outcome.answer}
              examplePending={examplePending || !ready}
              exampleMessage={exampleMessage}
              onExample={(state) => saveExample(outcome.answer, state)}
              sample={sampleName(outcome.settings.sample)}
              version={versionOf(outcome.settings)}
            />
          )}
        </section>
      </div>
      <p className="admin-note admin-run-after">
        {writer
          ? "A writer has the same panel: Run is enabled, and a writer can set a candidate and confirm. Only the status is admin only."
          : "An admin and a writer see the same panel."}{" "}
        Admin and writer both may press Run (AI-RUN-PERMISSION).
      </p>
    </>
  );
}

function AnswerView({
  answer,
  version,
  sample,
  examplePending,
  exampleMessage,
  onExample,
}: {
  answer: Answer;
  version: string;
  sample: string;
  examplePending: boolean;
  exampleMessage: string;
  onExample: (state: "candidate" | "confirmed") => void;
}) {
  const checks = answer.checks;
  return (
    <>
      {answer.recorded ? null : (
        <p className="admin-errbox" role="alert">
          <span>
            <b>The end of this run was not recorded.</b> The answer came, but the run log still
            shows the run as not ended, without its tokens and cost. It counts in today&apos;s runs
            on the Runs page.
          </span>
        </p>
      )}
      <p className="admin-run-model">
        {answer.stub ? (
          <>
            <span className="admin-pill admin-pill-mark">Fake model (stub)</span>{" "}
            <span className="admin-note">
              The answer is fixed test text, not written by a model.
            </span>
          </>
        ) : (
          <span className="admin-note">Model: {answer.model}</span>
        )}
      </p>
      <pre aria-label="Answer" className="admin-code">
        {answer.output}
      </pre>
      <table aria-label="Checks" className="admin-table admin-run-checks">
        <thead>
          <tr>
            <th scope="col">Check that applies</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {!checks.applied ? (
            <tr>
              <td>{checks.note}</td>
              <td>
                <span className="admin-pill admin-pill-draft">Not checked</span>
              </td>
            </tr>
          ) : checks.passed ? (
            <tr>
              <td>Every check of this call (parse and line checks)</td>
              <td>
                <span className="admin-pill admin-pill-published">Pass</span>
              </td>
            </tr>
          ) : (
            checks.failedRules.map((rule) => (
              <tr key={rule}>
                <td>
                  Rule <span className="admin-chip">{rule}</span>
                </td>
                <td>
                  <span className="admin-pill admin-pill-failed">Fail</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <dl className="admin-fields admin-run-fields">
        <dt>Tokens</dt>
        <dd>{tokensText(answer.inputTokens, answer.outputTokens)}</dd>
        <dt>Cost</dt>
        <dd>{costText(answer.cost, answer.costNote, answer.stub)}</dd>
        <dt>Prompt version</dt>
        <dd>{version}</dd>
        <dt>Sample</dt>
        <dd>{sample}</dd>
      </dl>
      <div className="admin-run-buttons">
        <button
          className="button-gray"
          disabled={examplePending || !answer.recorded}
          onClick={() => onExample("candidate")}
          type="button"
        >
          Set as candidate example
        </button>
        <button
          className="button-gray"
          disabled={examplePending || !answer.recorded}
          onClick={() => onExample("confirmed")}
          type="button"
        >
          Confirm
        </button>
      </div>
      <p className="admin-src">
        {answer.recorded
          ? "Confirm records who and when; a replaced confirmed example stays in history."
          : "An answer whose run was not recorded cannot become the example."}
      </p>
      {exampleMessage ? (
        <p className="admin-src" role="status">
          {exampleMessage}
        </p>
      ) : null}
    </>
  );
}
