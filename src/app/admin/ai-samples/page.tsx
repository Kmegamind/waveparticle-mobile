import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { readContentRole } from "@/lib/admin/roles";
import { chosenSample, readSampleLibrary, type LibrarySample } from "@/lib/ai-samples/library";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../admin-ui";
import { RolePill } from "../ai-features/registry-ui";

// AIR-6 Samples (#479; docs/PRD.md section 4.15, AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS), as the
// drawing docs/design/prototype/admin-ai-features.html (#reg-samples): the sample library that
// fills a prompt's {{variables}}, as a list (name, Companion, the source named, words of the
// excerpt) and the chosen sample's inputs below it (?sample=<id>, the first by default). Read only.
// The layout already checked the role (admin or writer); the rows come through the signed-in
// user's own client, and row level security gives them to content editors only. The samples
// reach the database only through the owner's import (AI-SAMPLES-LOCAL).
export default function AdminAiSamples({ searchParams }: PageProps<"/admin/ai-samples">) {
  return (
    <Suspense fallback={<SamplesLoading />}>
      <Samples searchParams={searchParams} />
    </Suspense>
  );
}

const NOT_WRITTEN = <span className="admin-note">Not written yet</span>;

function Head({ role }: { role: "admin" | "writer" | null }) {
  return (
    <>
      <Breadcrumb items={[{ label: "AI rules" }]} />
      <PageHead
        title="Samples"
        lede={
          <>
            The sample library that fills a prompt&apos;s{" "}
            <span className="admin-var">{"{{variables}}"}</span>.{" "}
            <span className="admin-lock">Admin and writer only</span>: never read by the app or
            users.
          </>
        }
        actions={role ? <RolePill role={role} /> : undefined}
      />
    </>
  );
}

/** The drawing's loading state: the panel with three grey lines while the rows are read. */
function SamplesLoading() {
  return (
    <>
      <Head role={null} />
      <div aria-busy="true" className="admin-panel" role="status">
        <h2 className="admin-panel-title">Loading the sample library…</h2>
        <div className="admin-skel admin-skel-80" />
        <div className="admin-skel" />
        <div className="admin-skel admin-skel-60" />
      </div>
    </>
  );
}

async function Samples({
  searchParams,
}: {
  searchParams: PageProps<"/admin/ai-samples">["searchParams"];
}) {
  await connection();
  const { sample: wanted } = await searchParams;
  const client = await createSupabaseServerClient();
  const [samples, role] = await Promise.all([
    readSampleLibrary(async (table, order) => {
      const { data, error } = await client.from(table).select("*").order(order);
      return { data, error };
    }),
    readContentRole(client),
  ]);
  const viewer = role === "admin" ? "admin" : "writer";
  const chosen = samples ? chosenSample(samples, wanted) : null;
  return (
    <>
      <Head role={viewer} />
      {samples === null ? (
        <p className="admin-errbox" role="alert">
          <span>
            <b>The sample library could not be read.</b> This page calls no model.
          </span>
          <Link className="button-gray button-small" href="/admin/ai-samples">
            Retry
          </Link>
        </p>
      ) : null}
      <div className="admin-panel">
        {!samples || samples.length === 0 ? (
          <p className="admin-empty">No samples yet</p>
        ) : (
          <SampleList chosen={chosen} samples={samples} />
        )}
      </div>
      {chosen ? <SampleDetail sample={chosen} /> : null}
      <p className="admin-note admin-samples-after">
        {viewer === "writer"
          ? "A writer reads the library. Samples are added by the owner's import."
          : "Samples are added by the owner's import (AI-SAMPLES-LOCAL); book text never enters the code repository."}
      </p>
    </>
  );
}

function SampleList({
  samples,
  chosen,
}: {
  samples: LibrarySample[];
  chosen: LibrarySample | null;
}) {
  return (
    <table className="admin-table admin-samples">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Companion</th>
          <th scope="col">Source named</th>
          <th scope="col">Words</th>
        </tr>
      </thead>
      <tbody>
        {samples.map((sample) => {
          const current = sample.id === chosen?.id;
          return (
            <tr className={`admin-row-click${current ? " admin-row-sel" : ""}`} key={sample.id}>
              <td>
                <Link
                  aria-current={current ? "true" : undefined}
                  className="admin-row-link"
                  href={`/admin/ai-samples?sample=${encodeURIComponent(sample.id)}`}
                  scroll={false}
                >
                  {sample.name}
                </Link>
              </td>
              <td>{sample.companion ?? NOT_WRITTEN}</td>
              <td>{sample.source ?? NOT_WRITTEN}</td>
              <td className="admin-cell-note">
                {sample.words === null ? "No excerpt" : `${sample.words.toLocaleString("en")}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TextField({ value }: { value: string }) {
  return value.trim() ? <span className="admin-field-text">{value}</span> : NOT_WRITTEN;
}

function SampleDetail({ sample }: { sample: LibrarySample }) {
  return (
    <section aria-label={sample.name} className="admin-panel admin-samples-detail">
      <h2>{sample.name}</h2>
      <dl className="admin-fields">
        <dt>Persona</dt>
        <dd>
          <TextField value={sample.persona} />
        </dd>
        <dt>Source excerpt</dt>
        <dd>
          {sample.excerpt === null ? NOT_WRITTEN : <TextField value={sample.excerpt} />}
          <p className="admin-src">Source: {sample.source ?? "Not written yet"}</p>
        </dd>
        <dt>Background</dt>
        <dd>
          <TextField value={sample.background} />
        </dd>
        <dt>Facts</dt>
        <dd>
          {sample.facts.length === 0 ? (
            NOT_WRITTEN
          ) : (
            <ul className="admin-samples-list">
              {sample.facts.map((fact, index) => (
                <li key={index}>{fact}</li>
              ))}
            </ul>
          )}
        </dd>
        <dt>World record</dt>
        <dd>
          <TextField value={sample.worldRecord} />
        </dd>
        <dt>Standing task</dt>
        <dd>
          <TextField value={sample.standingTask} />
        </dd>
        <dt>Finished plan</dt>
        <dd>
          {sample.plan === null ? (
            NOT_WRITTEN
          ) : (
            <>
              {sample.plan.goal ? <p className="admin-samples-goal">{sample.plan.goal}</p> : null}
              {sample.plan.aims.length > 0 ? (
                <ol className="admin-samples-list">
                  {sample.plan.aims.map((aim, index) => (
                    <li key={index}>
                      <b>{aim.title}</b>
                      {aim.note ? ` ${aim.note}` : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}
