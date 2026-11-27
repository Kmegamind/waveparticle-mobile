import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentRole } from "@/lib/admin/roles";
import { featureName, formatRunTime } from "@/lib/ai-features/admin";
import {
  costOf,
  filterRuns,
  parseRunFilter,
  peopleFromSpend,
  RUN_STATE_LABEL,
  RUNS_SHOWN,
  runBy,
  runsHref,
  runState,
  todayCounts,
  type RunLogRow,
  type RunState,
  type RunStepRow,
} from "@/lib/ai-runs/log";
import { costText, formatUsd, modelErrorText, tokensText, versionLabel } from "@/lib/ai-runs/panel";
import { readRunSpend, todayWindow, type RunSpend } from "@/lib/ai-runs/spend";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead } from "../admin-ui";
import { RolePill } from "../ai-features/registry-ui";
import { RunsFilter } from "./runs-filter";

// AIR-5 Runs (#477; docs/PRD.md FR-AILAB-3, AI-RUN-PERMISSION, AI-LAB-STUB), as the drawing
// docs/design/prototype/admin-ai-features.html (#reg-runs): every run of the prompt lab, newest
// first (who, when, feature, prompt version, sample, model, tokens, cost, stub), today's spend and
// the total by user for today (the UTC day), a filter, and the chosen run's detail with its input
// and output. Read only; the page calls no model. The layout already checked the role (admin or
// writer); the run log is read with the signed-in user's own client, and row level security gives
// it to content editors only. A run that never ended is shown as "Run in progress" and, after the
// route's time limit, as "End not recorded": never hidden.
export default function AdminAiRuns({ searchParams }: PageProps<"/admin/ai-runs">) {
  return (
    <Suspense fallback={<RunsLoading />}>
      <Runs searchParams={searchParams} />
    </Suspense>
  );
}

const RUN_COLUMNS =
  "id,run_by,run_at,finished_at,feature_slug,prompt_key,prompt_source,prompt_version,sample_id,model,input_tokens,output_tokens,cost,stub,status,error_reason";

function Head({ role }: { role: "admin" | "writer" | null }) {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        title="Runs"
        lede={
          <>
            Every run: who, when, feature, prompt version, sample, model, tokens, cost and whether
            the model was a stub (<KeyChip>/admin/ai-runs</KeyChip>). There is no spending cap.
          </>
        }
        actions={role ? <RolePill role={role} /> : undefined}
      />
    </>
  );
}

function RunsLoading() {
  return (
    <>
      <Head role={null} />
      <div aria-busy="true" className="admin-panel" role="status">
        <h2>Loading the run log…</h2>
        <div className="admin-skel admin-skel-80" />
        <div className="admin-skel" />
        <div className="admin-skel admin-skel-60" />
      </div>
    </>
  );
}

type Answer<T> = Promise<T | null>;

async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Answer<T[]> {
  try {
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return null;
    return data as T[];
  } catch {
    return null;
  }
}

async function readAll(client: SupabaseClient, now: Date) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  };
  const day = todayWindow(now);
  const [runs, today, spend, everyone, features, samples, role] = await Promise.all([
    rows<RunLogRow>(
      client
        .from("ai_runs")
        .select(RUN_COLUMNS)
        .order("run_at", { ascending: false })
        .limit(RUNS_SHOWN),
    ),
    rows<Pick<RunLogRow, "run_at" | "stub">>(
      client.from("ai_runs").select("run_at,stub").gte("run_at", day.from).lt("run_at", day.to),
    ),
    readRunSpend(rpc, now),
    // Who ran anything, at any time: ai_run_spend names each account by email.
    rpc("ai_run_spend", {
      from_time: "1970-01-01T00:00:00Z",
      to_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }).catch(() => ({ data: null, error: true })),
    rows<{ slug: string; feature_id: string | null; title: string }>(
      client.from("ai_features").select("slug,feature_id,title").order("position"),
    ),
    rows<{ id: string; name: string }>(client.from("ai_samples").select("id,name")),
    readContentRole(client),
  ]);
  return {
    runs,
    today,
    spend,
    people: peopleFromSpend(everyone.error ? null : everyone.data),
    features: features ?? [],
    samples: new Map((samples ?? []).map((sample) => [sample.id, sample.name])),
    role,
  };
}

async function Runs({
  searchParams,
}: {
  searchParams: PageProps<"/admin/ai-runs">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const filter = parseRunFilter(params);
  const chosenId = typeof params.run === "string" ? params.run : null;
  const client = await createSupabaseServerClient();
  const now = new Date();
  const data = await readAll(client, now);
  const viewer = data.role === "admin" ? "admin" : "writer";

  const feature = new Map(data.features.map((row) => [row.slug, row]));
  const featureLabel = (slug: string) => {
    const row = feature.get(slug);
    return { id: row?.feature_id ?? slug, name: row ? featureName(row.title) : "" };
  };
  const sampleLabel = (id: string | null) =>
    id === null ? "No sample" : (data.samples.get(id) ?? id);

  if (data.runs === null) {
    return (
      <>
        <Head role={viewer} />
        <p className="admin-errbox" role="alert">
          <span>
            <b>The run log could not be read.</b> This page calls no model.
          </span>
          <Link className="button-gray button-small" href={runsHref(filter)}>
            Retry
          </Link>
        </p>
      </>
    );
  }

  const shown = filterRuns(data.runs, filter);
  const chosen = shown.find((row) => row.id === chosenId) ?? shown[0] ?? null;
  const counts = todayCounts(data.today ?? data.runs, now);
  const models = [...new Set(data.runs.map((row) => row.model))].sort();
  const users = [...new Set(data.runs.map((row) => row.run_by))].map((id) => ({
    id: id ?? "",
    label: runBy(id, data.people),
  }));

  return (
    <>
      <Head role={viewer} />
      <Tiles counts={counts} spend={data.spend} />
      <div className="admin-grid2 admin-runs-top">
        <section aria-labelledby="runs-by-user" className="admin-panel">
          <h2 id="runs-by-user">Total by user, today (UTC)</h2>
          <ByUser people={data.people} spend={data.spend} />
        </section>
        <section aria-labelledby="runs-filter" className="admin-panel">
          <h2 id="runs-filter">Filter</h2>
          <RunsFilter
            features={data.features.map((row) => ({
              value: row.slug,
              label: `${row.feature_id ?? row.slug} ${featureName(row.title)}`,
            }))}
            filter={filter}
            models={models}
            users={users.filter((user) => user.id !== "")}
          />
        </section>
      </div>
      <div className="admin-panel admin-panel-scroll">
        {data.runs.length === 0 ? (
          <p className="admin-empty">No runs yet</p>
        ) : shown.length === 0 ? (
          <p className="admin-empty">No run matches this filter</p>
        ) : (
          <table aria-label="Runs" className="admin-table admin-runs">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Feature</th>
                <th scope="col">Version</th>
                <th scope="col">Sample</th>
                <th scope="col">Model</th>
                <th className="admin-num" scope="col">
                  Tokens
                </th>
                <th className="admin-num" scope="col">
                  Cost
                </th>
                <th scope="col">Stub</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const current = row.id === chosen?.id;
                const label = featureLabel(row.feature_slug);
                const cost = costOf(row);
                return (
                  <tr className={`admin-row-click${current ? " admin-row-sel" : ""}`} key={row.id}>
                    <td className="admin-cell-note">
                      <Link
                        aria-current={current ? "true" : undefined}
                        className="admin-row-link admin-runs-when"
                        href={runsHref(filter, row.id)}
                        scroll={false}
                      >
                        <time dateTime={row.run_at}>{formatRunTime(row.run_at)}</time>
                      </Link>
                    </td>
                    <td>{runBy(row.run_by, data.people)}</td>
                    <td>
                      <KeyChip>{label.id}</KeyChip> {label.name}
                    </td>
                    <td>{versionLabel(row.prompt_source, row.prompt_version)}</td>
                    <td className="admin-cell-note">{sampleLabel(row.sample_id)}</td>
                    <td>{row.model}</td>
                    <td className="admin-num">
                      {row.input_tokens === null && row.output_tokens === null
                        ? "—"
                        : (row.input_tokens ?? 0) + (row.output_tokens ?? 0)}
                    </td>
                    <td className="admin-num">{cost === null ? "—" : formatUsd(cost)}</td>
                    <td>
                      {row.stub ? (
                        <span className="admin-pill admin-pill-mark">Stub</span>
                      ) : (
                        <span className="admin-note">Real</span>
                      )}
                    </td>
                    <td>
                      <ResultPill state={runState(row, now)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {data.runs.length >= RUNS_SHOWN ? (
          <p className="admin-src">
            The newest {RUNS_SHOWN} runs are listed; older runs stay in the run log.
          </p>
        ) : null}
      </div>
      {chosen ? (
        <RunDetail
          client={client}
          feature={featureLabel(chosen.feature_slug)}
          now={now}
          people={data.people}
          run={chosen}
          sample={sampleLabel(chosen.sample_id)}
        />
      ) : null}
      <p className="admin-note admin-runs-after">
        Today&apos;s spend is a read-only line, not a cap. Today is the UTC day.
      </p>
    </>
  );
}

function Tiles({
  counts,
  spend,
}: {
  counts: { runs: number; stub: number; real: number };
  spend: RunSpend | null;
}) {
  return (
    <div className="admin-tiles">
      <div className="admin-tile">
        <b className="admin-tile-number">{spend ? formatUsd(spend.cost) : "—"}</b>
        <span className="admin-tile-label">
          {spend === null
            ? "Today's spend could not be read"
            : spend.unpricedRuns > 0
              ? `Today's spend · ${spend.unpricedRuns} without a cost`
              : "Today's spend"}
        </span>
      </div>
      <div className="admin-tile">
        <b className="admin-tile-number">{counts.runs}</b>
        <span className="admin-tile-label">Runs today</span>
      </div>
      <div className="admin-tile">
        <b className="admin-tile-number">{counts.stub}</b>
        <span className="admin-tile-label">Stub runs</span>
      </div>
      <div className="admin-tile">
        <b className="admin-tile-number">{counts.real}</b>
        <span className="admin-tile-label">Real model runs</span>
      </div>
    </div>
  );
}

function ByUser({ spend, people }: { spend: RunSpend | null; people: Map<string, string | null> }) {
  if (spend === null) {
    return (
      <p className="admin-notice" role="alert">
        Today&apos;s spend could not be read. Try again later.
      </p>
    );
  }
  if (spend.byUser.length === 0) return <p className="admin-empty">No runs yet</p>;
  return (
    <table aria-label="Total by user, today" className="admin-table">
      <thead>
        <tr>
          <th scope="col">User</th>
          <th className="admin-num" scope="col">
            Runs
          </th>
          <th className="admin-num" scope="col">
            Spend today
          </th>
        </tr>
      </thead>
      <tbody>
        {spend.byUser.map((row) => (
          <tr key={row.userId ?? "deleted"}>
            <td>{row.email ?? runBy(row.userId, people)}</td>
            <td className="admin-num">{row.runs}</td>
            <td className="admin-num">
              {formatUsd(row.cost)}
              {row.unpricedRuns > 0 ? (
                <span className="admin-runs-unpriced"> · {row.unpricedRuns} without a cost</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResultPill({ state }: { state: RunState }) {
  const tone = state === "ok" ? "published" : state === "running" ? "running" : "failed";
  return <span className={`admin-pill admin-pill-${tone}`}>{RUN_STATE_LABEL[state]}</span>;
}

async function RunDetail({
  client,
  run,
  feature,
  sample,
  people,
  now,
}: {
  client: SupabaseClient;
  run: RunLogRow;
  feature: { id: string; name: string };
  sample: string;
  people: Map<string, string | null>;
  now: Date;
}) {
  const [full, steps] = await Promise.all([
    rows<RunLogRow>(
      client.from("ai_runs").select("id,input,output,pasted_text").eq("id", run.id).limit(1),
    ),
    rows<RunStepRow>(
      client.from("ai_run_steps").select("*").eq("run_id", run.id).order("position"),
    ),
  ]);
  const text = full?.[0] ?? null;
  const state = runState(run, now);
  const cost = costOf(run);
  return (
    <section aria-labelledby="run-detail" className="admin-panel admin-runs-detail">
      <h2 id="run-detail">
        Run detail <KeyChip>{feature.id}</KeyChip>
        {run.stub ? <span className="admin-pill admin-pill-mark">Fake model (stub)</span> : null}
      </h2>
      <dl className="admin-fields admin-runs-fields">
        <dt>Who and when</dt>
        <dd>
          {runBy(run.run_by, people)} ·{" "}
          <time dateTime={run.run_at}>{formatRunTime(run.run_at)}</time>
          {run.finished_at ? null : " · not ended"}
        </dd>
        <dt>Feature</dt>
        <dd>
          {feature.name || feature.id} · prompt <KeyChip>{run.prompt_key}</KeyChip>
        </dd>
        <dt>Prompt version</dt>
        <dd>{versionLabel(run.prompt_source, run.prompt_version)}</dd>
        <dt>Sample</dt>
        <dd>{sample}</dd>
        <dt>Model</dt>
        <dd>
          {run.model} · tokens {tokensText(run.input_tokens, run.output_tokens)} ·{" "}
          {state !== "ok"
            ? "no cost recorded"
            : costText(
                cost,
                run.input_tokens === null || run.output_tokens === null
                  ? "tokens not reported"
                  : "price not set",
                run.stub,
              )}
        </dd>
        <dt>Result</dt>
        <dd>
          <ResultPill state={state} />
        </dd>
      </dl>
      {text === null ? (
        <p className="admin-notice" role="alert">
          The input and output of this run could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-grid2">
          <div>
            <p className="admin-note admin-cmp-label">Input</p>
            <pre aria-label="Input" className="admin-code">
              {text.input ?? ""}
            </pre>
          </div>
          <div>
            <p className="admin-note admin-cmp-label">Output</p>
            {state === "ok" ? (
              <pre aria-label="Output" className="admin-code">
                {text.output ?? ""}
              </pre>
            ) : state === "error" ? (
              <p className="admin-errbox" role="alert">
                <span>
                  <b>The model did not answer.</b> {modelErrorText(run.error_reason ?? "request")}
                </span>
                <Link
                  className="button-gray button-small"
                  href={`/admin/ai-features/${run.feature_slug}/run`}
                >
                  Retry
                </Link>
              </p>
            ) : state === "running" ? (
              <div role="status">
                <p className="admin-run-progress">
                  <span className="admin-pill admin-pill-running">Run in progress</span> This run
                </p>
                <div className="admin-run-bar">
                  <i />
                </div>
              </div>
            ) : (
              <p className="admin-errbox" role="alert">
                <span>
                  <b>The end of this run was not recorded.</b> It was sent to the model, so it may
                  have been billed, but its answer, tokens and cost were not stored.
                </span>
              </p>
            )}
          </div>
        </div>
      )}
      {steps && steps.length > 0 ? (
        <table aria-label="Steps" className="admin-table admin-after-text">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Prompt</th>
              <th className="admin-num" scope="col">
                Tokens
              </th>
              <th className="admin-num" scope="col">
                Cost
              </th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const stepCost = costOf(step);
              return (
                <tr key={step.position}>
                  <td>
                    {step.position}. {step.label}
                  </td>
                  <td>
                    {step.prompt_key ? <KeyChip>{step.prompt_key}</KeyChip> : "—"}
                    {step.prompt_version ? ` v${step.prompt_version}` : null}
                  </td>
                  <td className="admin-num">{tokensText(step.input_tokens, step.output_tokens)}</td>
                  <td className="admin-num">{stepCost === null ? "—" : formatUsd(stepCost)}</td>
                  <td>
                    <ResultPill state={step.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
