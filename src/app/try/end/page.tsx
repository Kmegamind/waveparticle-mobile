import Link from "next/link";

// The focus page of the sign-in-free test path opens /try/end after its last Done. The test path
// keeps no account, so it has no summary yet; the signed-in summary is /end (#258).
export default function TryEndPage() {
  return (
    <main className="app-screen try-screen" data-ready="true">
      <p>There is no summary to show.</p>
      <Link href="/try">Go back to the test home</Link>
    </main>
  );
}
