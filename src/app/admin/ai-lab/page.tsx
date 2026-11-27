import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { featureName, featurePrompts, readAiFeatures } from "@/lib/ai-features/admin";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import type { LabPrompt } from "@/lib/ai-runs/comparison";
import { labModelsFromEnv } from "@/lib/ai-runs/model";
import { readSampleLibrary } from "@/lib/ai-samples/library";
import { promptVariables, sampleValues } from "@/lib/ai-samples/variables";
import { readPromptVersions, versionsOf } from "@/lib/prompts/admin";
import { callInputNames } from "@/lib/ai-runs/call-inputs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, KeyChip, PageHead } from "../admin-ui";
import { RolePill } from "../ai-features/registry-ui";
import { ComparisonLab, type LabFeature } from "./lab";

export const instant = false;

// AIR-4 the comparison lab (#478; docs/PRD.md FR-AILAB-4, FR-AILAB-5; AI-LAB-SAMPLES,
// AI-REGISTRY-FIELDS, AI-LAB-STUB), as the drawing docs/design/prototype/admin-ai-features.html
// (#reg-lab): one sample through two sides, each a prompt version or a model, the two answers side
// by side, Blind, and the feature's pass questions answered yes or no for each side, saved with
// both runs. The page reads the registry rows, their prompt versions and the sample library with
// the signed-in user's own client; it gives the browser only each model's name and whether it is
// the stub, never a key (FR-AILAB-2). Each side runs through POST /admin/ai-runs/run (#476).

export default function AdminAiLab({ searchParams }: PageProps<"/admin/ai-lab">) {
  return (
    <Suspense fallback={<LabLoading />}>
      <Lab searchParams={searchParams} />
    </Suspense>
  );
}

function Head({ role }: { role: "admin" | "writer" | null }) {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        title="Comparison lab"
        lede={
          <>
            The same sample through two prompt versions or two models, side by side (
            <KeyChip>/admin/ai-lab</KeyChip>). No user text is ever sent through the lab.
          </>
        }
        actions={role ? <RolePill role={role} /> : undefined}
      />
    </>
  );
}

function LabLoading() {
  return (
    <>
      <Head role={null} />
      <div aria-busy="true" className="admin-panel" role="status">
        <h2>Loading features, samples and versions…</h2>
        <div className="admin-skel admin-skel-80" />
        <div className="admin-skel" />
        <div className="admin-skel admin-skel-60" />
      </div>
    </>
  );
}

function ReadError({ what }: { what: string }) {
  return (
    <p className="admin-errbox" role="alert">
      <span>
        <b>{what} could not be read.</b> Nothing was run.
      </span>
      <Link className="button-gray button-small" href="/admin/ai-lab">
        Retry
      </Link>
    </p>
  );
}

async function Lab({ searchParams }: { searchParams: PageProps<"/admin/ai-lab">["searchParams"] }) {
  await connection();
  const query = await searchParams;
  const client = await createSupabaseServerClient();
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  };
  const [features, versions, samples, role] = await Promise.all([
    readAiFeatures(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
    readPromptVersions(rpc),
    readSampleLibrary(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
    readContentRole(client),
  ]);
  const viewer = role === "admin" ? "admin" : "writer";
  const head = <Head role={viewer} />;
  if (features === null) {
    return (
      <>
        {head}
        <ReadError what="The AI features" />
      </>
    );
  }
  if (versions === null) {
    return (
      <>
        {head}
        <ReadError what="The prompt versions" />
      </>
    );
  }

  const labFeatures: LabFeature[] = (features as RegistryFeature[]).map((feature) => ({
    slug: feature.slug,
    id: feature.feature_id ?? "",
    name: featureName(feature.title),
    questions: (feature.pass_questions ?? []).map((item) => item.text),
    // Only each version's number and its {{variables}} reach the browser, not the prompt text.
    prompts: featurePrompts(feature.prompt_keys ?? [], versions).map((prompt): LabPrompt => ({
      key: prompt.key,
      published: prompt.published
        ? {
            version: prompt.published.version,
            variables: promptVariables(prompt.published.body),
          }
        : null,
      draft: prompt.draft
        ? { version: prompt.draft.version, variables: promptVariables(prompt.draft.body) }
        : null,
      // #517: every stored version of the key, active or not, so a side can run any of them.
      stored: versionsOf(prompt.key, versions).versions.map((row) => ({
        version: row.version,
        active: row.active,
        variables: promptVariables(row.body),
      })),
      // #517: a runtime key's call inputs beside the sample (src/lib/ai-runs/call-inputs.ts).
      callInputs: feature.category === "runtime" ? callInputNames(prompt.key) : [],
    })),
  }));
  // Only the names and the stub flags reach the browser; the keys stay in this server module.
  const models = labModelsFromEnv(process.env).map((model) => ({
    name: model.name,
    stub: model.stub,
  }));
  const wanted = typeof query.feature === "string" ? query.feature : "";
  const first = labFeatures.find((item) => item.slug === wanted) ?? labFeatures[0];

  return (
    <>
      {head}
      {labFeatures.length === 0 || !first ? (
        <p className="admin-empty">No features yet</p>
      ) : (
        <ComparisonLab
          features={labFeatures}
          firstFeature={first.slug}
          models={models}
          samples={
            samples === null
              ? null
              : samples.map((item) => {
                  const values = sampleValues(item);
                  const empty = Object.keys(values).filter((name) => values[name] === null);
                  return { id: item.id, name: item.name, empty };
                })
          }
          writer={viewer === "writer"}
        />
      )}
    </>
  );
}
