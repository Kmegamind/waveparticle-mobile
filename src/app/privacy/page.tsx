import Link from "next/link";

// Placeholder for the privacy notice (US-ACC-4), linked from Sign in and Create an account (#262).
// Like the prototype, it says only that the notice is not written yet.
export default function PrivacyPage() {
  return (
    <main className="auth-page">
      <div className="auth-body">
        <h1>Privacy notice</h1>
        <p className="auth-lead">The privacy notice is not written yet.</p>
        <p className="auth-links">
          <Link href="/auth/sign-in">Back to Sign in</Link>
        </p>
      </div>
    </main>
  );
}
