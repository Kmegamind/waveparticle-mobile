import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { featureName, featurePrompts } from "@/lib/ai-features/admin";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import { labModelFromEnv } from "@/lib/ai-runs/model";
import { formatUsd } from "@/lib/ai-runs/panel";
import { readRunSpend } from "@/lib/ai-runs/spend";
import { readSampleLibrary } from "@/lib/ai-samples/library";
import { readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../../../admin-ui";
import { readFeature } from "../../load";
import { RolePill } from "../../registry-ui";
import { RunPanel } from "./run-panel";

export const instant = false;

// #477 (FR-AILAB-1 to FR-AILAB-3, FR-AILAB-6; AI-RUN-PERMISSION, AI-LAB-STUB, AI-RUN-LIVE): the
// Run panel of one registry row, as the drawing docs/design/prototype/admin-ai-features.html
// (#reg-run, AIR-3), opened by Run on the feature page. Admin and writer both run. The page reads
// the row, its prompt versions, the sample library and today's spend with the signed-in user's
// own client; it gives the browser only the model's name and whether it is the stub, never the
// key (FR-AILAB-2). The run itself is POST /admin/ai-runs/run (#476).

const LEDE =
  "Admin and writer can both run. The model key stays on the server; there is no spending cap and every run is recorded.";

export default function AdminAiFeatureRun({ params }: PageProps<"/admin/ai-features/[slug]/run">) {
  return (
    <Suspense fallback={<RunLoading />}>
      <Run params={params} />
    </Suspense>
  );
}

function Head({
  id,
  name,
  slug,
  role,
}: {
  id: string;
  name: string;
  slug?: string;
  role?: "admin" | "writer";
}) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "AI rules" },
          { label: "AI features", href: "/admin/ai-features" },
          slug ? { label: id, href: `/admin/ai-features/${slug}` } : { label: id },
          { label: "Run" },
        ]}
      />
      <PageHead
        title={`Run ${id}${name ? ` ${name}` : ""}`}
        lede={LEDE}
        actions={role ? <RolePill role={role} /> : undefined}
      />
    </>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <div aria-busy="true" className="admin-panel" role="status">
      <h2>Loading {what}…</h2>
      <div className="admin-skel admin-skel-80" />
      <div className="admin-skel" />
      <div className="admin-skel admin-skel-60" />
    </div>
  );
}

/** The drawing's loading state: both panels with three grey lines while the server reads. */
function RunLoading() {
  return (
    <>
      <Head id="" name="" />
      <div className="admin-grid2">
        <Loading what="prompt versions and samples" />
        <Loading what="the answer" />
      </div>
    </>
  );
}

async function Run({ params }: { params: PageProps<"/admin/ai-features/[slug]/run">["params"] }) {
  await connection();
  const { slug } = await params;
  const client = await createSupabaseServerClient();
  const feature = (await readFeature(client, slug)) as RegistryFeature | null | undefined;
  if (feature === undefined) notFound();
  if (feature === null) {
    return (
      <>
        <Head id={slug} name="" />
        <p className="admin-errbox" role="alert">
          <span>
            <b>This AI feature could not be read.</b> Nothing was run.
          </span>
          <Link className="button-gray button-small" href={`/admin/ai-features/${slug}/run`}>
            Retry
          </Link>
        </p>
      </>
    );
  }

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  };
  const [versions, samples, spend, role] = await Promise.all([
    readPromptVersions(rpc),
    readSampleLibrary(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
    readRunSpend(rpc),
    readContentRole(client),
  ]);
  const viewer = role === "admin" ? "admin" : "writer";
  const name = featureName(feature.title);
  const head = <Head id={feature.feature_id} name={name} role={viewer} slug={slug} />;

  if (versions === null) {
    return (
      <>
        {head}
        <p className="admin-errbox" role="alert">
          <span>
            <b>The prompt versions could not be read.</b> Nothing was run.
          </span>
          <Link className="button-gray button-small" href={`/admin/ai-features/${slug}/run`}>
            Retry
          </Link>
        </p>
      </>
    );
  }

  const prompts = featurePrompts(feature.prompt_keys ?? [], versions);
  // Only the name and the stub flag reach the browser; the key stays in this server module.
  const lab = labModelFromEnv(process.env);
  const model = lab ? { name: lab.name, stub: lab.stub } : null;
  const spendLine =
    spend === null
      ? "Today's spend could not be read. Not a cap."
      : `Today's spend (UTC day): ${formatUsd(spend.cost)}${
          spend.unpricedRuns > 0
            ? `, and ${spend.unpricedRuns} ${spend.unpricedRuns === 1 ? "run" : "runs"} without a cost`
            : ""
        }. Not a cap.`;

  return (
    <>
      {head}
      {prompts.length === 0 ? (
        <p className="admin-empty">This feature has no prompt to run.</p>
      ) : (
        <RunPanel
          exampleSetAt={feature.example_set_at ?? null}
          exampleState={feature.example_state ?? "none"}
          model={model}
          prompts={prompts}
          samples={
            samples === null ? null : samples.map((item) => ({ id: item.id, name: item.name }))
          }
          slug={slug}
          spendLine={spendLine}
          writer={viewer === "writer"}
        />
      )}
    </>
  );
}
