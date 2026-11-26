import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumb, KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";
import { readContentRole } from "@/lib/admin/roles";
import { hotlineList } from "@/lib/hotlines/admin";
import { readHotlineVersions } from "@/lib/hotlines/repository";
import { contactLabel, countryList, DIRECTORY, isCountryCode } from "@/lib/safety/help-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./hotlines.css";

export const instant = false;

// ADM-14 Hotlines (#118, HOTLINES; drawn in docs/design/prototype/admin-hotlines_2026-11-23_v1.html):
// the help line S1 shows for each country. Only the admin role edits and publishes; writers read.
// #448: in the prototype's layout: Add an entry is the header row's main button, and the table
// sits in a panel with its note under it. The button submits the country list under the panel.
export default async function AdminHotlines({ searchParams }: PageProps<"/admin/hotlines">) {
  await connection();
  const client = await createSupabaseServerClient();
  const [{ ok, rows }, role] = await Promise.all([
    readHotlineVersions(client),
    readContentRole(client),
  ]);
  const { add } = await searchParams;
  // #448 review I-1: an empty or unknown country opens nothing; the list says to choose one.
  const chosen = typeof add === "string" ? add.trim().toUpperCase() : null;
  const noCountry = chosen !== null && role === "admin" && !isCountryCode(chosen);
  if (chosen && !noCountry && role === "admin") redirect(`/admin/hotlines/${chosen}`);
  const list = hotlineList(rows, new Date());
  const listed = new Set(list.map((row) => row.country));
  const free = countryList().filter((country) => !listed.has(country.code));

  return (
    <>
      <Breadcrumb items={[{ label: "Content" }]} />
      <PageHead
        actions={
          ok && role === "admin" ? (
            // Submits the country list under the table (the form named here).
            <button className="button-filled" form="hotline-add" type="submit">
              Add an entry
            </button>
          ) : null
        }
        lede={
          <>
            The help line the safety page (S1) shows for each country. A country with no entry gets
            the international directory, {DIRECTORY.name} ({DIRECTORY.url.replace("https://", "")}),
            which is always shown as a link and is not an entry. Only the admin role edits and
            publishes; writers may only read. Owner: the product owner.
          </>
        }
        title="Hotlines"
      />
      {!ok ? (
        <p className="admin-notice" role="alert">
          The hotlines could not be read. Try again later.
        </p>
      ) : (
        <div className="admin-panel admin-hotline-list">
          <table className="admin-table">
            <thead>
              <tr>
                {/* Each heading is one unbreakable phrase (a no-break space), so a long cell
                    never squeezes it onto two lines; the prototype's headings are one line. */}
                <th scope="col">Country</th>
                <th scope="col">Service&nbsp;name</th>
                <th scope="col">Main&nbsp;contact</th>
                <th scope="col">State</th>
                <th scope="col">Last&nbsp;checked</th>
                <th scope="col">Checked&nbsp;by</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.country}>
                  <td>
                    <Link href={`/admin/hotlines/${row.country}`}>{row.name}</Link>{" "}
                    <KeyChip>{row.country}</KeyChip>
                  </td>
                  <td>
                    {row.shown.service_name ?? <span className="admin-note">None (optional)</span>}
                  </td>
                  <td>
                    {contactLabel({ kind: row.shown.primary_kind, value: row.shown.primary_value })}
                  </td>
                  <td>
                    <StatePill state={row.state}>
                      {row.state === "published" ? "Published" : "Draft"}
                    </StatePill>
                  </td>
                  <td className="admin-note">
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
          <p className="admin-history-note admin-hotline-list-note">
            An entry not checked in the last 6 months is marked &ldquo;Check due&rdquo;. Every entry
            is checked at least every 6 months and before each release.
          </p>
        </div>
      )}
      {ok && role === "admin" ? (
        // The country for Add an entry (header row). A country is chosen from the list and is fixed
        // once saved (#118); the drawing's empty entry with a typed country is not built.
        <form action="/admin/hotlines" className="admin-form admin-hotline-add" id="hotline-add">
          <label>
            Add an entry for a country with none
            {/* No country is chosen until the admin picks one (review I-1): Add an entry with
                nothing chosen is stopped by the browser, and by the server above. */}
            <select
              aria-describedby={noCountry ? "hotline-add-none" : undefined}
              className="admin-text-field"
              defaultValue=""
              name="add"
              required
            >
              <option value="">Choose a country</option>
              {free.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
          </label>
          {noCountry ? (
            <p className="admin-notice" id="hotline-add-none" role="alert">
              Choose a country from the list first. No entry was opened.
            </p>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
