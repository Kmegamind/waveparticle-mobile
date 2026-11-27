import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentRole } from "@/lib/admin/roles";
import {
  AI_FEATURE_STATUS_LABEL,
  featureName,
  featurePrompts,
  formatRunTime,
  readAiFeatures,
  readTestRuns,
  testRunGroups,
  type AiFeatureItem,
} from "@/lib/ai-features/admin";
import { statusHistory } from "@/lib/ai-features/edit";
import {
  CATEGORY_LABEL,
  exampleSetBy,
  isFeatureId,
  NOT_WRITTEN_YET,
  promptPanels,
  versionHistory,
  type ExampleHistoryRow,
  type FieldHistoryRow,
  type PromptPanel,
  type RegistryFeature,
} from "@/lib/ai-features/registry";
import { isPromptKey, readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "../../admin-ui";
import { FeatureStatusPill, ItemSource, MarkPill, NotWrittenYet } from "../feature-ui";
import { readPeople, readStatusHistory } from "../load";
import { ExamplePill, PromptBody, RolePill } from "../registry-ui";
import { StatusForm } from "../status-form";

export const instant = false;

// One AI feature of the registry (#474, registry slice 2; docs/PRD.md FR-AIREG-2 and FR-AIREG-4,
// AI-REGISTRY-FIELDS), as the drawing docs/design/prototype/admin-ai-features.html (#reg-feature):
// every field of the row in its own section, "Not written yet" for an empty one. The prompt panel
// shows each prompt key's published text and its draft side by side with their `{{variables}}`
// marked, and the changed lines, read live from public.prompts at page load (the call of ADM-08
// Prompts). Runtime rows also show Purpose and Current approach (sections (a) and (c) of #439,
// kept as they are, AI-REQUIREMENT-FIELD) and the retry_hints fix. Read only, except what #453
// built and keeps on the 7 Runtime rows: the editors of (a) to (c), linked from the header, and
// the status control (admin only, AI-PAGE-STATUS), which the drawing puts on this page. Pipeline
// and Quality gate rows are read only until #475. A row may also be opened by its Feature ID
// (/admin/ai-features/R-03), which goes to its slug. An unknown feature shows the not-found page.
export default async function AdminAiFeature({ params }: PageProps<"/admin/ai-features/[slug]">) {
  await connection();
  const { slug: param } = await params;
  const client = await createSupabaseServerClient();
  const features = (await readAiFeatures(async (table, order) => {
    const { data, error } = await client.from(table).select("*").order(order);
    return { data, error };
  })) as RegistryFeature[] | null;
  if (features !== null && isFeatureId(param)) {
    const byId = features.find((row) => row.feature_id === param);
    if (byId) redirect(`/admin/ai-features/${byId.slug}`);
  }
  const feature = features?.find((row) => row.slug === param) ?? null;
  if (features !== null && !feature) notFound();

  if (!feature) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "AI rules" },
            { label: "AI features", href: "/admin/ai-features" },
            { label: param },
          ]}
        />
        <PageHead title={param} />
        <p className="admin-errbox" role="alert">
          <span>
            <b>This AI feature could not be read.</b> This page calls no model.
          </span>
          <Link className="button-gray button-small" href={`/admin/ai-features/${param}`}>
            Retry
          </Link>
        </p>
      </>
    );
  }
  return <FeatureDetail client={client} feature={feature} />;
}

async function readRows<T>(
  client: SupabaseClient,
  table: string,
  slug: string,
  order: string,
): Promise<T[] | null> {
  try {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("feature_slug", slug)
      .order(order, { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data as T[];
  } catch {
    return null;
  }
}

async function FeatureDetail({
  client,
  feature,
}: {
  client: SupabaseClient;
  feature: RegistryFeature;
}) {
  const slug = feature.slug;
  const [runs, versions, history, people, fieldHistory, exampleHistory, role] = await Promise.all([
    readTestRuns(async () => {
      const { data, error } = await client
        .from("ai_feature_test_runs")
        .select("*")
        .eq("feature_slug", slug)
        .order("run_at", { ascending: false });
      return { data, error };
    }),
    readPromptVersions(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
    readStatusHistory(client, slug),
    readPeople(client, slug),
    readRows<FieldHistoryRow>(client, "ai_feature_field_history", slug, "changed_at"),
    readRows<ExampleHistoryRow>(client, "ai_feature_example_history", slug, "set_at"),
    readContentRole(client),
  ]);

  const runtime = feature.category === "runtime";
  const admin = role === "admin";
  const name = featureName(feature.title);
  const base = `/admin/ai-features/${slug}`;
  const panels = versions === null ? null : promptPanels(feature.prompt_keys ?? [], versions);
  const [retryHints] = versions === null ? [null] : featurePrompts(["retry_hints"], versions);
  const groups = testRunGroups(runs ?? []);
  const [latest] = statusHistory(feature, history ?? [], people);
  const changes =
    fieldHistory === null || history === null
      ? null
      : versionHistory(fieldHistory, history, people);
  const setBy = exampleSetBy(feature, people);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "AI rules" },
          { label: "AI features", href: "/admin/ai-features" },
          { label: feature.feature_id },
        ]}
      />
      <PageHead
        title={`${feature.feature_id} ${name}`}
        lede={`${CATEGORY_LABEL[feature.category] ?? feature.category} · Where it appears: ${
          feature.where_used || NOT_WRITTEN_YET
        }`}
        actions={
          <>
            <RolePill role={admin ? "admin" : "writer"} />
            {runtime ? (
              <>
                <Link className="button-gray" href={`${base}/purpose`}>
                  Edit purpose and approach
                </Link>
                <Link className="button-gray" href={`${base}/pass`}>
                  Edit pass standard
                </Link>
              </>
            ) : null}
          </>
        }
      />
      <div className="admin-sections">
        {runtime ? (
          <>
            <Section id="purpose" title="Purpose">
              <Items items={feature.purpose} />
            </Section>
            <Section id="approach" title="Current approach">
              <Items items={feature.approach} />
            </Section>
          </>
        ) : null}

        <Section id="requirement" title="Requirement">
          <Text value={feature.requirement} />
        </Section>

        <Section id="prompt" title="Prompt">
          {panels === null ? (
            <p className="admin-notice" role="alert">
              The prompts could not be read. Try again later.
            </p>
          ) : panels.length === 0 ? (
            <NotWrittenYet />
          ) : (
            <div className="admin-reg-prompts">
              {panels.map((panel) => (
                <PromptKey key={panel.key} panel={panel} />
              ))}
            </div>
          )}
        </Section>

        <Section id="output" title="Output format and rules">
          <Text value={feature.output_format} />
        </Section>
        <Section id="rationale" title="Design rationale">
          <Text value={feature.design_rationale} />
        </Section>
        <Section id="improve" title="Room to improve">
          <Text value={feature.room_to_improve} />
        </Section>

        <Section id="example" title="Confirmed example">
          {!feature.example_text ? (
            <NotWrittenYet />
          ) : (
            <>
              <p className="admin-example-meta">
                <ExamplePill state={feature.example_state} />{" "}
                <span className="admin-note">
                  {feature.example_state === "confirmed" ? "Confirmed by" : "Set by"} {setBy.person}
                  {setBy.dateTime ? (
                    <>
                      {" · "}
                      <time dateTime={setBy.dateTime}>{setBy.time}</time>
                    </>
                  ) : null}
                </span>
              </p>
              <p className="admin-field-text">{feature.example_text}</p>
              {exampleHistory === null ? (
                <p className="admin-notice admin-after-text" role="alert">
                  The earlier examples could not be read. Try again later.
                </p>
              ) : exampleHistory.length === 0 ? (
                <p className="admin-empty admin-after-text">No earlier examples</p>
              ) : (
                <table aria-label="Example history" className="admin-table admin-after-text">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Who</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exampleHistory.map((row) => {
                      const by = exampleSetBy(
                        { example_set_by: row.set_by, example_set_at: row.set_at },
                        people,
                      );
                      return (
                        <tr key={row.id}>
                          <td className="admin-cell-note">
                            <time dateTime={row.set_at}>{formatRunTime(row.set_at)}</time>
                          </td>
                          <td className="admin-history-person">{by.person}</td>
                          <td>
                            Set as <ExamplePill state={row.example_state} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </Section>

        <Section id="notes" title="Notes">
          <Text value={feature.notes} />
        </Section>

        <Section id="pass" title="Pass standard">
          {feature.pass_questions.length === 0 ? (
            <NotWrittenYet />
          ) : (
            <ol className="admin-questions">
              {feature.pass_questions.map((item, index) => (
                <li key={index}>
                  <span className="admin-question-text">{item.text}</span>
                  <ItemSource item={item} />
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section
          className={admin ? undefined : "admin-ro"}
          id="status"
          title={
            <>
              Status <FeatureStatusPill status={feature.status} />
              {admin ? null : <span className="admin-lock">Admin only</span>}
            </>
          }
        >
          {admin && runtime ? (
            <StatusForm readOnly={false} slug={slug} status={feature.status} />
          ) : null}
          {admin ? null : (
            <p className="admin-note">You can see the status. Only an admin can change it.</p>
          )}
          <p className="admin-src">
            {history === null ? (
              "Who set it could not be read"
            ) : (
              <>
                Set to {AI_FEATURE_STATUS_LABEL[latest.to]} by{" "}
                {latest.person === "Setup" ? "the setup" : latest.person}
                {latest.dateTime ? (
                  <>
                    {" · "}
                    <time dateTime={latest.dateTime}>{latest.time}</time>
                  </>
                ) : null}
              </>
            )}
            {runtime ? (
              <>
                {" · "}
                <Link href={`${base}/status`}>history and change (admin only)</Link>
              </>
            ) : null}
          </p>
        </Section>

        <Section id="history" title="Version history">
          {changes === null ? (
            <p className="admin-notice" role="alert">
              The version history could not be read. Try again later.
            </p>
          ) : changes.length === 0 ? (
            <p className="admin-empty">No changes yet</p>
          ) : (
            <table aria-label="Version history" className="admin-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Field</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((entry) => (
                  <tr key={entry.key}>
                    <td className="admin-cell-note">
                      <time dateTime={entry.dateTime}>{entry.time}</time>
                    </td>
                    <td className="admin-history-person">{entry.person}</td>
                    <td>
                      {entry.field}
                      {entry.status ? (
                        <>
                          {": "}
                          {entry.status.from ? (
                            <FeatureStatusPill status={entry.status.from} />
                          ) : (
                            "—"
                          )}{" "}
                          → <FeatureStatusPill status={entry.status.to} />
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {runtime ? (
          <Section
            id="retry"
            title={
              <>
                Fix added after a rejected answer <KeyChip>retry_hints</KeyChip>
              </>
            }
          >
            {retryHints === null ? (
              <p className="admin-notice" role="alert">
                The prompts could not be read. Try again later.
              </p>
            ) : retryHints.published ? (
              <pre aria-label="Published retry_hints" className="admin-code">
                <PromptBody text={retryHints.published.body} />
              </pre>
            ) : (
              <p className="admin-empty">No published version of retry_hints.</p>
            )}
            <p className="admin-src">
              The same text shows on every Runtime row. Edit it on the{" "}
              <Link href="/admin/prompts/retry_hints">Prompts page</Link>.
            </p>
          </Section>
        ) : null}

        <Section id="tests" title="Test results">
          {runs === null ? (
            <p className="admin-notice" role="alert">
              The test results could not be read. Try again later.
            </p>
          ) : groups.length === 0 ? (
            <p className="admin-empty">No run yet</p>
          ) : (
            <table aria-label="Test runs" className="admin-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Mode</th>
                  <th scope="col">Prompt versions</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key}>
                    <td className="admin-cell-note">
                      <time dateTime={group.dateTime}>{group.time}</time>
                    </td>
                    <td>{group.fake ? <MarkPill>Fake model (stub)</MarkPill> : "Real model"}</td>
                    <td>
                      {group.prompts.map((label, index) => (
                        <span key={label}>
                          {index > 0 ? " " : null}
                          <KeyChip>{label}</KeyChip>
                        </span>
                      ))}
                    </td>
                    <td>{group.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {groups.some((group) => !group.fake) ? null : (
            <p className="admin-empty admin-after-table">No real run yet (#413)</p>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`admin-panel admin-section${className ? ` ${className}` : ""}`}
      id={id}
    >
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}

/** A registry text field, or "Not written yet" (FR-AIREG-4). */
function Text({ value }: { value: string | null | undefined }) {
  if (!value || value.trim() === "") return <NotWrittenYet />;
  return <p className="admin-field-text">{value}</p>;
}

/** Purpose and Current approach: each item with its source, or "Not written yet". */
function Items({ items }: { items: AiFeatureItem[] }) {
  if (items.length === 0) return <NotWrittenYet />;
  return (
    <ul className="admin-items">
      {items.map((item, index) => (
        <li key={index}>
          <p className="admin-item-text">{item.text}</p>
          <ItemSource item={item} />
        </li>
      ))}
    </ul>
  );
}

const DIFF_MARK = { same: " ", added: "+", removed: "-" } as const;
const DIFF_SPOKEN = { same: "Same", added: "Added", removed: "Removed" } as const;

/** One prompt key: published and draft side by side, variables marked, then the changed lines. */
function PromptKey({ panel }: { panel: PromptPanel }) {
  const { key, published, draft, diff } = panel;
  return (
    <section aria-label={key} className="admin-reg-prompt-key">
      <p className="admin-prompt-meta">
        <KeyChip>
          {key}
          {published ? ` v${published.version}` : ""}
        </KeyChip>{" "}
        {published ? <StatePill state="published">Published</StatePill> : null}
        {draft ? (
          <>
            {" "}
            <StatePill state="draft">Draft v{draft.version}</StatePill>
          </>
        ) : null}
        {panel.category ? (
          <>
            {" "}
            <KeyChip>category: {panel.category}</KeyChip>
          </>
        ) : null}
      </p>
      <div className="admin-cmp">
        <div>
          <p className="admin-note admin-cmp-label">Published</p>
          {published ? (
            <pre aria-label={`Published ${key}`} className="admin-code">
              <PromptBody text={published.body} />
            </pre>
          ) : (
            <p className="admin-empty">No published version.</p>
          )}
        </div>
        <div>
          <p className="admin-note admin-cmp-label">Draft</p>
          {draft ? (
            <pre aria-label={`Draft v${draft.version} of ${key}`} className="admin-code">
              <PromptBody text={draft.body} />
            </pre>
          ) : (
            <p className="admin-empty">No draft.</p>
          )}
        </div>
      </div>
      {diff ? (
        <>
          <p className="admin-note admin-diff-label">Changed lines</p>
          <ol aria-label={`Changed lines of ${key}`} className="admin-reg-diff">
            {diff.map((line, index) => (
              <li className={`admin-reg-diff-${line.kind}`} key={index}>
                <span className="admin-diff-spoken">{DIFF_SPOKEN[line.kind]}: </span>
                <span aria-hidden="true">{DIFF_MARK[line.kind]} </span>
                <PromptBody text={line.text} />
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className="admin-src">
        Read live from <KeyChip>public.prompts</KeyChip>, never copied.
        {isPromptKey(key) ? (
          <>
            {" "}
            Edit it on the <Link href={`/admin/prompts/${key}`}>Prompts page</Link>.
          </>
        ) : null}
      </p>
    </section>
  );
}
