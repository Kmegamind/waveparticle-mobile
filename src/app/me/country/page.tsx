import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { readProfile } from "@/lib/me/supabase-profile";
import { countryList } from "@/lib/safety/help-lines";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";
import { CountryPicker } from "./country-picker";

export const instant = false;

// ME-REGION (#118, SAFETY-REGION): a child page of Me with the tab bar, like Signals. The country
// is used only to show help lines on the safety page; nothing is suggested from a location.
export default function Country() {
  return <CountryContent />;
}

async function CountryContent() {
  await connection();
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) redirect("/auth/sign-in");
  const profile = await readProfile(client, user.id);
  return (
    <main className="app-screen me-page">
      <Link aria-label="Back to Me" className="life-back" href="/me">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Me</span>
      </Link>
      <h1>Country</h1>
      <p className="me-quiet">
        Used only to show help lines on the safety page. We never read your location.
      </p>
      <CountryPicker chosen={profile.helpCountry} countries={countryList()} />
    </main>
  );
}
