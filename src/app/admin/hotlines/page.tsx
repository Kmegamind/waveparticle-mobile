import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumb, KeyChip, StatePill } from "@/app/admin/admin-ui";
import { readContentRole } from "@/lib/admin/roles";
import { hotlineList } from "@/lib/hotlines/admin";
import { readHotlineVersions } from "@/lib/hotlines/repository";
import { contactLabel, countryList, DIRECTORY } from "@/lib/safety/help-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

// ADM-14 Hotlines (#118, HOTLINES; drawn in docs/design/prototype/admin-hotlines_2026-11-23_v1.html):
// the help line S1 shows for each country. Only the admin role edits and publishes; writers read.
export default async function AdminHotlines({ searchParams }: PageProps<"/admin/hotlines">) {
  await connection();
  const client = await createSupabaseServerClient();
  const [{ ok, rows }, role] = await Promise.all([
    readHotlineVersions(client),
    readContentRole(client),
  ]);
  const { add } = await searchParams;
  if (typeof add === "string" && role === "admin") redirect(`/admin/hotlines/${add.toUpperCase()}`);
  const list = hotlineList(rows, new Date());
  const listed = new Set(list.map((row) => row.country));
  const free = countryList().filter((country) => !listed.has(country.code));

  return (
    <>
      <Breadcrumb items={[{ label: "Content" }]} />
      <h1>Hotlines</h1>
      <p className="admin-lede">
        The help line the safety page (S1) shows for each country. A country with no entry gets the
        international directory, {DIRECTORY.name} ({DIRECTORY.url.replace("https://", "")}), which
        is always shown as a link and is not an entry. Only the admin role edits and publishes;
        writers may only read. Owner: the product owner.
      </p>
      {!ok ? (
        <p className="admin-notice" role="alert">
          The hotlines could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Service name</th>
                <th scope="col">Main contact</th>
                <th scope="col">State</th>
                <th scope="col">Last checked</th>
                <th scope="col">Checked by</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.country}>
                  <td>
                    <Link href={`/admin/hotlines/${row.country}`}>{row.name}</Link>{" "}
                    <KeyChip>{row.country}</KeyChip>
                  </td>
                  <td>{row.shown.service_name ?? "None (optional)"}</td>
                  <td>
                    {contactLabel({ kind: row.shown.primary_kind, value: row.shown.primary_value })}
                  </td>
                  <td>
                    <StatePill state={row.state}>
                      {row.state === "published" ? "Published" : "Draft"}
                    </StatePill>
                  </td>
                  <td>
                    {row.shown.checked_on}
                    {row.checkDue ? (
                      <>
                        {" "}
                        <StatePill state="failed">Check due</StatePill>
                      </>
                    ) : null}
                  </td>
                  <td>{row.shown.checked_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="admin-history-note">
            An entry not checked in the last 6 months is marked &ldquo;Check due&rdquo;. Every entry
            is checked at least every 6 months and before each release.
          </p>
        </div>
      )}
      {ok && role === "admin" ? (
        <form action="/admin/hotlines" className="admin-text-form" method="get">
          <label className="admin-text-label" htmlFor="hotline-add">
            Add an entry for a country with none
          </label>
          <select className="admin-text-field" id="hotline-add" name="add">
            {free.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
          <div className="admin-text-actions">
            <button className="button-filled button-small" type="submit">
              Add an entry
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
