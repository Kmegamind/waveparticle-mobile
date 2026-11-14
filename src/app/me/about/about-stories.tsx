import Link from "next/link";

/**
 * About these stories (#104 AC1 AC2 AC3): the one place that says what is imagined and what the
 * app is not. No other screen carries a source label, and the conversation never mentions it (A4).
 */
export function AboutStories() {
  return (
    <article className="account-text">
      <p>
        The Companion&apos;s first-person lines are imagined. Some of his stories begin from real
        people, places and events, but what he thinks, says and feels in them was invented for
        WaveParticle. No line is a quotation.
      </p>
      <p>
        His lines are written by an AI, a language model, during your session. They are checked
        before you see them, but they can still get history wrong.
      </p>
      <p>
        WaveParticle is not a medical or crisis service. If you need someone now, here is{" "}
        <Link href="/safety">where to find help now</Link>.
      </p>
      <p>
        Read the <Link href="/terms">Terms</Link>.
      </p>
    </article>
  );
}
