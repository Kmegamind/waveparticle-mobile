import { TermsText } from "./terms-text";

// The Terms (#104). Public, so they can be read before an account exists.
export default function TermsPage() {
  return (
    <main className="app-screen account-page">
      <TermsText />
    </main>
  );
}
