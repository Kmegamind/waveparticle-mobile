import { PrivacyNotice } from "./privacy-notice";

export const instant = false;

// The privacy notice (#102, #8 AC3). Public: linked from Sign in, Create an account (#262) and
// Me, Data (?from=me), and it goes back to where it was opened from.
export default async function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  const { from } = await searchParams;
  return (
    <main className="app-screen account-page">
      <PrivacyNotice back={from === "me" ? "me" : "sign-in"} />
    </main>
  );
}
