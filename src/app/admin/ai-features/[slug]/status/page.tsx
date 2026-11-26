import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { featureName } from "@/lib/ai-features/admin";
import { statusHistory } from "@/lib/ai-features/edit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb, PageHead } from "../../../admin-ui";
import { FeatureStatusPill } from "../../feature-ui";
import { readFeature, readPeople, readStatusHistory } from "../../load";
import { StatusForm } from "../../status-form";
import "../../ai-features.css";

export const instant = false;

// #453 (part of #430 T6; AI-PAGE-STATUS): the status of one AI feature, as drawing AIF-5. Admins
// change it with an optional reason; writers see it and its history read-only. The history lists
// every change with when, who (by email, as Publish history), from, to and the reason, newest
// first, and ends with the setup row.
export default async function AdminAiFeatureStatus({
  params,
}: PageProps<"/admin/ai-features/[slug]/status">) {
  await connection();
  const { slug } = await params;
  const client = await createSupabaseServerClient();
  const [feature, history, people, role] = await Promise.all([
    readFeature(client, slug),
    readStatusHistory(client, slug),
    readPeople(client, slug),
    readContentRole(client),
  ]);
  if (feature === undefined) notFound();
  const name = feature ? featureName(feature.title) : slug;
  const crumbs = [
    { label: "AI rules" },
    { label: "AI features", href: "/admin/ai-features" },
    { label: name, href: `/admin/ai-features/${slug}` },
  ];
  if (!feature || history === null) {
    return (
      <>
        <Breadcrumb items={crumbs} />
        <PageHead title={`${feature?.title ?? slug} · status`} />
        <p className="admin-notice" role="alert">
          The status could not be read. Try again later.
        </p>
      </>
    );
  }
  const readOnly = role !== "admin";
  const entries = statusHistory(feature, history, people);

  return (
    <>
      <Breadcrumb items={crumbs} />
      <PageHead
        title={`${feature.title} · status`}
        lede={
          readOnly
            ? "You can see the status and its history. Only an admin can change it."
            : "Only an admin can change the status. Every change is kept with who, when and why."
        }
      />
      <div className="admin-grid2">
        <section
          aria-labelledby="change-heading"
          className={`admin-panel admin-section${readOnly ? " admin-ro" : ""}`}
        >
          <h2 id="change-heading">
            Change status {readOnly ? <span className="admin-lock">Admin only</span> : null}
          </h2>
          <StatusForm readOnly={readOnly} slug={slug} status={feature.status} />
        </section>
        <section aria-labelledby="now-heading" className="admin-panel admin-section">
          <h2 id="now-heading">
            Now <FeatureStatusPill status={feature.status} />
          </h2>
          <table aria-label="Status history" className="admin-table admin-table-nowrap-head">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">From → to</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key}>
                  <td className="admin-cell-note">
                    <time dateTime={entry.dateTime}>{entry.time}</time>
                  </td>
                  <td className="admin-history-person">{entry.person}</td>
                  <td>
                    {entry.from ? <FeatureStatusPill status={entry.from} /> : "—"} →{" "}
                    <FeatureStatusPill status={entry.to} />
                  </td>
                  <td className="admin-cell-note">{entry.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
