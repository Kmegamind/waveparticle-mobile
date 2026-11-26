import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumb, KeyChip, PageHead } from "@/app/admin/admin-ui";
import { readContentRole } from "@/lib/admin/roles";
import { hotlineVersions } from "@/lib/hotlines/admin";
import { readHotlineVersions } from "@/lib/hotlines/repository";
import { countryName, isCountryCode } from "@/lib/safety/help-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HotlineEditor } from "../hotline-editor";
import "../hotlines.css";

export const instant = false;

// ADM-15 Hotline entry (#118, HOTLINES): what S1 shows for one country, its versions, and (admin
// role only) Save draft, Publish and Roll back. Writers see the same page read-only. #448: in the
// prototype's layout, with Save draft and Publish in the header row (drawn by the editor).
export default async function AdminHotline({ params }: PageProps<"/admin/hotlines/[country]">) {
  await connection();
  const { country } = await params;
  if (!isCountryCode(country)) notFound();
  const client = await createSupabaseServerClient();
  const [{ ok, rows }, role] = await Promise.all([
    readHotlineVersions(client),
    readContentRole(client),
  ]);
  const versions = hotlineVersions(rows, country);
  if (ok && versions.length === 0 && role !== "admin") notFound();
  const name = countryName(country);
  const title = (
    <>
      Hotline entry <KeyChip>{`hotline.${country}`}</KeyChip>
    </>
  );
  const lede = `What S1 shows for ${name}. An entry with no service name shows only its contact line.`;

  return (
    <>
      <Breadcrumb items={[{ label: "Hotlines", href: "/admin/hotlines" }, { label: name }]} />
      {!ok || !role ? (
        <>
          <PageHead lede={lede} title={title} />
          <p className="admin-notice" role="alert">
            This entry could not be read. Try again later.
          </p>
        </>
      ) : (
        <HotlineEditor
          country={country}
          lede={lede}
          name={name}
          role={role}
          title={title}
          versions={versions}
        />
      )}
    </>
  );
}
