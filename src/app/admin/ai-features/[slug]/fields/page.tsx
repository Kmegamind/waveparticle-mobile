import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentRole } from "@/lib/admin/roles";
import { featureName, formatRunTime } from "@/lib/ai-features/admin";
import { personName, type People } from "@/lib/ai-features/edit";
import {
  CATEGORY_LABEL,
  type ExampleHistoryRow,
  type FieldHistoryRow,
  type RegistryFeature,
} from "@/lib/ai-features/registry";
import {
  exampleChanges,
  fieldChanges,
  registryEditorValues,
} from "@/lib/ai-features/registry-edit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../../../admin-ui";
import { readFeature, readPeople } from "../../load";
import { CategoryForm, ExampleForm, RegistryFieldsEditor } from "../../registry-editor";
import { ExamplePill } from "../../registry-ui";

export const instant = false;

// #475 (registry slice 3; docs/PRD.md section 4.14 and FR-AIREG-7, AI-PAGE-EDIT,
// AI-EXAMPLE-CONFIRM; docs/decisions/0035): the editor of one registry row, for admins and writers
// (the admin layout's role check), linked from the feature page (#reg-feature). The name and the
// six text fields are one form with Save in the header, as the drawing's AIF-7, and its side panel
// the last save; under it the example and its state (any role), the category (admin only; a writer
// sees it dimmed, as the status) and the field history: who, when, the field, the old and the new
// value. Every row of every category is edited here.

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

const personOf = (id: string | null, people: People) =>
  personName(id, id ? (people?.get(id) ?? null) : null);

export default async function AdminAiFeatureFields({
  params,
}: PageProps<"/admin/ai-features/[slug]/fields">) {
  await connection();
  const { slug } = await params;
  const client = await createSupabaseServerClient();
  const [row, people, fieldHistory, exampleHistory, role] = await Promise.all([
    readFeature(client, slug),
    readPeople(client, slug),
    readRows<FieldHistoryRow>(client, "ai_feature_field_history", slug, "changed_at"),
    readRows<ExampleHistoryRow>(client, "ai_feature_example_history", slug, "set_at"),
    readContentRole(client),
  ]);
  if (row === undefined) notFound();
  const feature = row as RegistryFeature | null;
  const crumbs = [
    { label: "AI rules" },
    { label: "AI features", href: "/admin/ai-features" },
    {
      label: feature?.feature_id ?? slug,
      href: `/admin/ai-features/${slug}`,
    },
  ];
  if (!feature) {
    return (
      <>
        <Breadcrumb items={crumbs} />
        <PageHead title={`${slug} · registry fields`} />
        <p className="admin-notice" role="alert">
          This AI feature could not be read. Try again later.
        </p>
      </>
    );
  }

  const admin = role === "admin";
  const lastSave = feature.fields_updated_at
    ? {
        time: formatRunTime(feature.fields_updated_at),
        dateTime: feature.fields_updated_at,
        person: personOf(feature.fields_updated_by, people),
      }
    : null;
  const changes = fieldHistory === null ? null : fieldChanges(fieldHistory, people);
  const examples = exampleHistory === null ? null : exampleChanges(exampleHistory, people);

  return (
    <>
      <Breadcrumb items={crumbs} />
      <RegistryFieldsEditor
        lastSave={lastSave}
        loadedAt={feature.fields_updated_at ?? null}
        slug={slug}
        title={`${feature.feature_id} ${featureName(feature.title)} · registry fields`}
        values={registryEditorValues(feature)}
      />
      <div className="admin-sections admin-after-editor">
        <section
          aria-labelledby="example-heading"
          className="admin-panel admin-section"
          id="example"
        >
          <h2 id="example-heading">
            Confirmed example <ExamplePill state={feature.example_state ?? "none"} />
          </h2>
          <ExampleForm
            loadedAt={feature.example_set_at ?? null}
            slug={slug}
            state={feature.example_state ?? "none"}
            text={feature.example_text ?? ""}
          />
          <p className="admin-src">
            Any role may set an example candidate or confirmed. Each one is kept below with who and
            when, so a replaced confirmed example stays in the history.
          </p>
          {examples === null ? (
            <p className="admin-notice admin-after-text" role="alert">
              The earlier examples could not be read. Try again later.
            </p>
          ) : examples.length === 0 ? (
            <p className="admin-empty admin-after-text">No earlier examples</p>
          ) : (
            <table aria-label="Example history" className="admin-table admin-after-text">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Change</th>
                  <th scope="col">Text</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((entry) => (
                  <tr key={entry.key}>
                    <td className="admin-cell-note">
                      <time dateTime={entry.dateTime}>{entry.time}</time>
                    </td>
                    <td className="admin-history-person">{entry.person}</td>
                    <td>
                      Set as <ExamplePill state={entry.state} />
                    </td>
                    <td className="admin-history-value">
                      {entry.text === "" ? <NotWrittenYetText /> : entry.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          aria-labelledby="category-heading"
          className={`admin-panel admin-section${admin ? "" : " admin-ro"}`}
          id="category"
        >
          <h2 id="category-heading">
            Category {admin ? null : <span className="admin-lock">Admin only</span>}
          </h2>
          <CategoryForm category={feature.category} readOnly={!admin} slug={slug} />
          {admin ? null : (
            <p className="admin-note">You can see the category. Only an admin can change it.</p>
          )}
          <p className="admin-src">
            Now {CATEGORY_LABEL[feature.category] ?? feature.category}. The status is changed on the{" "}
            <Link href={`/admin/ai-features/${slug}#status`}>feature page</Link> (admin only).
          </p>
        </section>

        <section
          aria-labelledby="history-heading"
          className="admin-panel admin-section"
          id="history"
        >
          <h2 id="history-heading">Field history</h2>
          {changes === null ? (
            <p className="admin-notice" role="alert">
              The field history could not be read. Try again later.
            </p>
          ) : changes.length === 0 ? (
            <p className="admin-empty">No changes yet</p>
          ) : (
            <table aria-label="Field history" className="admin-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Field</th>
                  <th scope="col">Old</th>
                  <th scope="col">New</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((entry) => (
                  <tr key={entry.key}>
                    <td className="admin-cell-note">
                      <time dateTime={entry.dateTime}>{entry.time}</time>
                    </td>
                    <td className="admin-history-person">{entry.person}</td>
                    <td>{entry.field}</td>
                    <td className="admin-history-value">
                      {entry.from === "" ? <NotWrittenYetText /> : entry.from}
                    </td>
                    <td className="admin-history-value">
                      {entry.to === "" ? <NotWrittenYetText /> : entry.to}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

/** An empty value in a history cell: the words of FR-AIREG-4, muted, not a box. */
function NotWrittenYetText() {
  return <span className="admin-note">Not written yet</span>;
}
