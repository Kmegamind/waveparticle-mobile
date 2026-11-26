import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { companionPage } from "@/lib/content-fields/pages";
import { readCompanionsData } from "@/lib/content-fields/reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileFields } from "./profile-fields";
import { Breadcrumb, PageHead } from "@/app/admin/admin-ui";
import "./companion-profile.css";

export const instant = false;

const COMPANION_ID = /^[a-z][a-z0-9-]*$/;

// ADM-04 and ADM-05, one Companion (#309, #442): the header row with Save draft and Publish, then
// tabs. Profile lists his profile fields; Life Path lists each period's name with its stories in
// order, each story opening its own fields. Names, never dates (PERIODS).
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
      {!data.ok || !page || !role ? (
        <>
          <PageHead title={page?.name ?? "Companion"} />
          <p className="admin-notice" role="alert">
            This Companion could not be read. Try again later.
          </p>
        </>
      ) : (
        <ProfileFields page={page} role={role} />
      )}
    </>
  );
}
