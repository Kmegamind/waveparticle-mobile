import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import {
  AI_FEATURE_STATUSES,
  AI_FEATURE_STATUS_LABEL,
  readAiFeatures,
} from "@/lib/ai-features/admin";
import { registryRow, type RegistryFeature } from "@/lib/ai-features/registry";
import { readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../admin-ui";
import { RegistryTable } from "./registry-table";
import { RolePill } from "./registry-ui";

// ADM-16 AI features, the registry (#474, registry slice 2; docs/PRD.md FR-AIREG-1, AI-REGISTRY,
// AI-REGISTRY-FIELDS), as the drawing docs/design/prototype/admin-ai-features.html
// (#reg-registry): every AI feature, from book to dialogue, in one table with its ID, name,
// category, where it appears, requirement, prompt (key and the version published now, and the
// draft when there is one, read live from public.prompts), status and example state. Read only.
// The layout already checked the role (admin or writer); every row comes through the signed-in
// user's own client, the prompts through public.list_prompt_versions as on ADM-08 Prompts.
export default function AdminAiFeatures() {
  return (
    <Suspense fallback={<RegistryLoading />}>
      <Registry />
    </Suspense>
  );
}

function Head({ role }: { role: "admin" | "writer" | null }) {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        title="AI features"
        lede="One table of every AI feature, from book to dialogue."
        actions={role ? <RolePill role={role} /> : undefined}
      />
    </>
  );
}

/** The drawing's loading state: the panel with three grey lines while the rows are read. */
function RegistryLoading() {
  return (
    <>
      <Head role={null} />
      <div aria-busy="true" className="admin-panel" role="status">
        <h2 className="admin-panel-title">Loading the registry…</h2>
        <div className="admin-skel admin-skel-80" />
        <div className="admin-skel" />
        <div className="admin-skel admin-skel-60" />
      </div>
    </>
  );
}

async function Registry() {
  await connection();
  const client = await createSupabaseServerClient();
  const [features, versions, role] = await Promise.all([
    readAiFeatures(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
    readPromptVersions(async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      return { data, error };
    }),
    readContentRole(client),
  ]);
  const rows = ((features ?? []) as RegistryFeature[]).map((feature) =>
    registryRow(feature, versions),
  );
  const viewer = role === "admin" ? "admin" : "writer";
  return (
    <>
      <Head role={viewer} />
      {features === null ? (
        <p className="admin-errbox" role="alert">
          <span>
            <b>The registry could not be read.</b> This page calls no model.
          </span>
          <Link className="button-gray button-small" href="/admin/ai-features">
            Retry
          </Link>
        </p>
      ) : null}
      {features !== null && versions === null ? (
        <p className="admin-notice" role="alert">
          The prompts could not be read. Try again later.
        </p>
      ) : null}
      <RegistryTable
        admin={viewer === "admin"}
        rows={rows}
        statuses={AI_FEATURE_STATUSES.map((value) => ({
          value,
          label: AI_FEATURE_STATUS_LABEL[value],
        }))}
        unreadable={features === null}
      />
    </>
  );
}
