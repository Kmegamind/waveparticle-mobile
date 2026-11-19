import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { companionPage } from "@/lib/content-fields/pages";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FieldEditor } from "../field-editor";
import { Breadcrumb } from "@/app/admin/admin-ui";

export const instant = false;

const COMPANION_ID = /^[a-z][a-z0-9-]*$/;

// ADM-04 and ADM-05, one Companion (#309): his profile fields, then his Life Path: each period's
// name and its stories in order, each story opening its own fields. Names, never dates (PERIODS).
export default async function AdminCompanion({ params }: PageProps<"/admin/companions/[id]">) {
  await connection();
  const { id } = await params;
  if (!COMPANION_ID.test(id)) notFound();
  const client = await createSupabaseServerClient();
  const [data, role] = await Promise.all([readCompanionsData(client, id), readContentRole(client)]);
  const companion = data.companions.find((row) => row.id === id);
  if (data.ok && !companion) notFound();
  const page = companion ? companionPage(companion, data.stories, data.fields) : null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Companions", href: "/admin/companions" },
          { label: page?.name ?? "Companion" },
        ]}
      />
      <h1>{page?.name ?? "Companion"}</h1>
      {page ? (
        <p className="admin-text-key">
          {page.key} · {page.mode === "fictional" ? "Fictional" : "Historical"}
        </p>
      ) : null}
      <p className="admin-lede">
        Saving a field makes a new draft; the app and the phones keep the published text. A text
        with a year, a date or an age is refused, because these fields appear on the Life Path. An
        admin publishes; every publish and roll back is in Publish history.
      </p>
      {!data.ok || !page || !role ? (
        <p className="admin-notice" role="alert">
          This Companion could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-text-list">
          <section aria-labelledby="profile-heading" className="admin-text">
            <h2 className="admin-story-part" id="profile-heading">
              Profile
            </h2>
            {page.profile.map((entry) => (
              <FieldEditor
                field={entry.view}
                key={entry.view.key}
                label={entry.label}
                limit={entry.limit}
                role={role}
              />
            ))}
          </section>
          <section aria-labelledby="life-path-heading" className="admin-text">
            <h2 className="admin-story-part" id="life-path-heading">
              Life Path
            </h2>
            {page.periods.length === 0 ? <p className="admin-lede">No stories yet.</p> : null}
            {page.periods.map((period) => (
              <section aria-label={`Period ${period.number}: ${period.name}`} key={period.number}>
                <FieldEditor
                  field={period.field.view}
                  label={period.field.label}
                  limit={period.field.limit}
                  role={role}
                  rows={1}
                />
                <ol aria-label={`Stories of period ${period.number}`} className="admin-card-list">
                  {period.stories.map((story) => (
                    <li key={story.id}>
                      <span className="admin-page-id">{story.sequence}</span>{" "}
                      <Link href={`/admin/companions/${page.id}/stories/${story.id}`}>
                        {story.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
