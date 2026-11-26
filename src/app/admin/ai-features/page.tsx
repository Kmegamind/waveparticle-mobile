import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  AI_FEATURE_STATUSES,
  indexRow,
  readAiFeatures,
  readTestRuns,
} from "@/lib/ai-features/admin";
import { readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "../admin-ui";
import { FeatureStatusPill, MarkPill } from "./feature-ui";

// ADM-16 AI features (#439, part of #430; AI-PAGES-7): the 7 AI features with their status, the
// published version of their prompts and their last imported test run, as the drawing
// docs/design/prototype/admin-ai-features.html (#index). Read only. The layout already checked the
// role (admin or writer); every row comes through the signed-in user's own client, the prompts
// through public.list_prompt_versions as on ADM-08 Prompts.
export default function AdminAiFeatures() {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        title="AI features"
        lede="One page per AI feature: what it does for the user, how we judge it, how it works now, where it stands, its prompts and its test results."
      />
      <Suspense fallback={null}>
        <FeatureTable />
      </Suspense>
    </>
  );
}

async function FeatureTable() {
  await connection();
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
        .order("run_at", { ascending: false });
      return { data, error };
    }),
    readPromptVersions(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
  ]);
  const rows = (features ?? []).map((feature) => indexRow(feature, versions ?? [], runs ?? []));
  return (
    <>
      {features === null ? (
        <p className="admin-notice" role="alert">
          The AI features could not be read. Try again later.
        </p>
      ) : null}
      {versions === null || runs === null ? (
        <p className="admin-notice" role="alert">
          The prompts or the test runs could not be read. Try again later.
        </p>
      ) : null}
      <div className="admin-panel admin-scroll">
        {/* As the drawing, the table sizes its own columns. Its headings keep to one line
            (admin-table-nowrap-head): see the exception in e2e/admin-visual.spec.ts. */}
        <table aria-label="AI features" className="admin-table admin-table-nowrap-head">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Purpose</th>
              <th scope="col">Status</th>
              <th scope="col">Active prompt</th>
              <th scope="col">Last offline run</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="admin-cell-note" colSpan={5}>
                  No features yet
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.slug}>
                <td>
                  <b>
                    <Link href={`/admin/ai-features/${row.slug}`}>{row.title}</Link>
                  </b>
                </td>
                <td className="admin-cell-note">{row.purpose ?? "Not written yet"}</td>
                <td>
                  <FeatureStatusPill status={row.status} />
                </td>
                <td>
                  <KeyChip>{row.versions.join(" · ")}</KeyChip>
                  {row.draftExists ? (
                    <>
                      {" "}
                      <StatePill state="draft">Draft exists</StatePill>
                    </>
                  ) : null}
                </td>
                <td>
                  {row.lastRun ? (
                    <>
                      <span className="admin-cell-note">{row.lastRun.time}</span>
                      <br />
                      {row.lastRun.fake ? <MarkPill>Fake model (stub)</MarkPill> : "Real model"}
                    </>
                  ) : (
                    <span className="admin-cell-note">No run yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div aria-label="Statuses" className="admin-legend" role="note">
          {AI_FEATURE_STATUSES.map((status) => (
            <span key={status}>
              <FeatureStatusPill status={status} />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
