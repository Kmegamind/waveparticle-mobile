import Link from "next/link";

/**
 * The Terms (#104 AC2 AC3). A draft: every sentence here is for the owner to confirm, and legal
 * approves the final text before release (#104 AC4).
 */

export const TERMS_DATE = "November 14, 2026";

export function TermsText() {
  return (
    <article className="account-text">
      <Link aria-label="Back to About the stories" className="life-back" href="/me/about">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">About</span>
      </Link>
      <h1>Terms</h1>
      <p className="account-date">Last changed: {TERMS_DATE}</p>

      <h2>What WaveParticle is</h2>
      <p>
        WaveParticle helps you work on your own Goals, one Step at a time, while a Companion lives a
        story beside you.
      </p>

      <h2>The Companion is an AI</h2>
      <p>
        The Companion is a character. His lines are written by an AI, a language model. His stories
        are imagined: some begin from real people, places and events, but what he thinks, says and
        feels in them was invented for WaveParticle.
      </p>

      <h2>Not a medical or crisis service</h2>
      <p>
        WaveParticle is not a medical or crisis service, and it gives no medical, psychological or
        legal advice. If you are in danger or thinking about harming yourself, contact your local
        emergency number or a crisis line now. <Link href="/safety">Find help now</Link>.
      </p>

      <h2>Your data</h2>
      <p>
        What you write stays yours. The <Link href="/privacy">Privacy notice</Link> says what we
        keep and what we send to the language model. You can export your data or delete your account
        at any time from Me, Data.
      </p>

      <h2>Changes</h2>
      <p>When these Terms change, the date at the top changes.</p>
    </article>
  );
}
