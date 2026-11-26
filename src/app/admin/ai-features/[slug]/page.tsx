import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import {
  featureName,
  featurePrompts,
  readAiFeatures,
  readTestRuns,
  testRunGroups,
  type AiFeatureItem,
  type FeaturePrompt,
} from "@/lib/ai-features/admin";
import { readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "../../admin-ui";
import { FeatureStatusPill, ItemSource, MarkPill, NotWrittenYet } from "../feature-ui";

export const instant = false;

// One AI feature (#439, part of #430; AI-PAGES, AI-PAGE-STORE, AI-PAGE-RUNS), as the drawing
// docs/design/prototype/admin-ai-features.html (#feature). The read view: (a) purpose, (b) pass
// standard and (c) current approach from public.ai_features, each item with its source and the
// "Draft - owner to edit" mark, "Not written yet" for an empty section; (d) the status; (e) each
// prompt key's published text and its draft, read live from public.prompts at page load with the
// call of ADM-08 Prompts; the retry_hints fix; (f) the imported test runs, fake-model runs marked.
// Editing (a) to (c) and changing the status come with #430 T6 (AI-PAGE-EDIT). An unknown feature
// shows the normal not-found page.
export default async function AdminAiFeature({ params }: PageProps<"/admin/ai-features/[slug]">) {
  await connection();
  const { slug } = await params;
  const client = await createSupabaseServerClient();
  const [features, runs, versions] = await Promise.all([
    readAiFeatures(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
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
  ]);
  const feature = features?.find((row) => row.slug === slug) ?? null;
  if (features !== null && !feature) notFound();

  const crumbs = [
    { label: "AI rules" },
    { label: "AI features", href: "/admin/ai-features" },
    { label: feature ? featureName(feature.title) : slug },
  ];
  if (!feature) {
    return (
      <>
        <Breadcrumb items={crumbs} />
        <PageHead title={slug} />
        <p className="admin-notice" role="alert">
          This AI feature could not be read. Try again later.
        </p>
      </>
    );
  }

  const prompts = versions === null ? null : featurePrompts(feature.prompt_keys, versions);
  const [retryHints] = versions === null ? [null] : featurePrompts(["retry_hints"], versions);
  const groups = testRunGroups(runs ?? []);

  return (
    <>
      <Breadcrumb items={crumbs} />
      <PageHead
        title={feature.title}
        lede="Every AI feature page has the same six sections, (a) to (f), in this order."
      />
      <div className="admin-sections">
        <Section id="purpose" title="(a) Purpose">
          <Items items={feature.purpose} />
        </Section>

        <Section id="pass" title="(b) Pass standard">
          {feature.pass_questions.length === 0 ? (
            <NotWrittenYet />
          ) : (
            <ol className="admin-questions">
              {feature.pass_questions.map((item, index) => (
                <li key={index}>
                  {item.text}
                  <ItemSource item={item} />
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section id="approach" title="(c) Current approach">
          <Items items={feature.approach} />
        </Section>

        <Section
          id="status"
          title={
            <>
              (d) Status <FeatureStatusPill status={feature.status} />
            </>
          }
        >
          <p className="admin-note">
            Only an admin changes the status; every change is kept with who, when and why.
          </p>
        </Section>

        <Section id="prompt" title="(e) Prompt text">
          {prompts === null ? (
            <p className="admin-notice" role="alert">
              The prompts could not be read. Try again later.
            </p>
          ) : (
            <div className={prompts.length > 1 ? "admin-grid2" : undefined}>
              {prompts.map((prompt) => (
                <PromptText key={prompt.key} prompt={prompt} />
              ))}
            </div>
          )}
        </Section>

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
              {retryHints.published.body}
            </pre>
          ) : (
            <p className="admin-empty">No published version of retry_hints.</p>
          )}
          <p className="admin-src">
            The same text shows on every feature page. Edit it on the{" "}
            <Link href="/admin/prompts/retry_hints">Prompts page</Link>.
          </p>
        </Section>

        <Section id="tests" title="(f) Test results">
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
  children,
}: {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="admin-panel admin-section">
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}

/** (a) and (c): each item with its source, or "Not written yet". */
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

/** (e) one prompt key: its published text and, when one exists, its newest draft. */
function PromptText({ prompt }: { prompt: FeaturePrompt }) {
  return (
    <section aria-label={prompt.key}>
      <p className="admin-prompt-meta">
        <KeyChip>{prompt.key}</KeyChip>{" "}
        {prompt.published ? (
          <>
            <KeyChip>v{prompt.published.version}</KeyChip>{" "}
            <StatePill state="published">Published</StatePill>
          </>
        ) : null}
        {prompt.draft ? (
          <>
            {" "}
            <StatePill state="draft">Draft v{prompt.draft.version}</StatePill>
          </>
        ) : null}
      </p>
      {prompt.published ? (
        <pre aria-label={`Published ${prompt.key}`} className="admin-code">
          {prompt.published.body}
        </pre>
      ) : (
        <p className="admin-empty">No published version. Every call that uses this prompt fails.</p>
      )}
      {prompt.draft ? (
        <>
          <p className="admin-src">Draft v{prompt.draft.version}, not published yet:</p>
          <pre
            aria-label={`Draft v${prompt.draft.version} of ${prompt.key}`}
            className="admin-code"
          >
            {prompt.draft.body}
          </pre>
        </>
      ) : (
        <p className="admin-src">No draft.</p>
      )}
    </section>
  );
}
