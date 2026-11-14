import Link from "next/link";

/**
 * The privacy notice (#102, #8 AC3), in plain sentences. Every statement here comes from the code
 * as of the date below; change the date whenever the notice changes (#102 AC3). The sentences that
 * sound legal are drafts for the owner to confirm (listed in pull request #103's description).
 */

export const PRIVACY_NOTICE_DATE = "November 14, 2026";

export function PrivacyNotice({ back }: { back: "me" | "sign-in" }) {
  return (
    <article className="account-text">
      {back === "me" ? (
        <Link aria-label="Back to Data" className="life-back" href="/me/data">
          <span aria-hidden="true">‹</span>
          <span className="focus-label">Data</span>
        </Link>
      ) : (
        <Link aria-label="Back to Sign in" className="life-back" href="/auth/sign-in">
          <span aria-hidden="true">‹</span>
          <span className="focus-label">Sign in</span>
        </Link>
      )}
      <h1>Privacy notice</h1>
      <p className="account-date">Last changed: {PRIVACY_NOTICE_DATE}</p>
      <p>
        This notice says what WaveParticle keeps, where it keeps it, and what it sends to a language
        model.
      </p>

      <h2>What we keep on our server</h2>
      <p>
        We keep your email address, and your password in a protected form, so that you can sign in.
      </p>
      <p>
        We keep your display name and whether you want the clock to keep running when you leave.
      </p>
      <p>
        For each Goal you write, we keep its title, the text you wrote, the time you chose, whether
        you asked for finer Steps, its status, its type, and when it was created and last changed.
        For each Step of a Plan, we keep its title, its description and its minutes.
      </p>
      <p>
        We keep your history: which story each session played, when the session started, was last
        active and was finished, when each Step was opened and when you marked it done.
      </p>
      <p>
        We keep the lines he showed you: the background card, his story cards, his pause messages
        and which pause each belonged to, his return lines, the closing line of a finished story and
        the key moments of that story.
      </p>
      <p>
        All of this is tied to your account, so that your Goals and history are the same on every
        device you sign in on.
      </p>

      <h2>What stays on your device</h2>
      <p>
        The rest conversation stays on your device: neither your messages nor his replies are stored
        on our server. The session clocks, Appearance, Plain text, Signals and the History view are
        also kept only on your device.
      </p>

      <h2>What we send to the language model</h2>
      <p>
        His lines are written by a language model that another company runs, the model provider.
      </p>
      <p>
        When you split a Goal into Steps, the Goal you write, the time you chose and whether you
        asked for finer Steps are sent to the language model. In the rest conversation, each message
        you write in the rest conversation is sent to the language model, so that he can answer you.
        With each new message, your last few messages and his replies are sent again, so that he can
        follow the conversation.
      </p>
      <p>
        Nothing else you write is sent. His story cards, pause messages, return lines and closing
        lines are written from his own story, without your words.
      </p>
      <p>
        How long the model provider keeps what we send is not yet decided. When it is decided, this
        notice will say so and the date at the top will change.
      </p>

      <h2>Safety and logs</h2>
      <p>
        Before a Goal or a message is used, a safety check runs in our app and compares the words
        with a list, so nothing is sent anywhere for it. If it finds words about harming yourself,
        it shows you where to find help, and that text is not sent to the language model.
      </p>
      <p>
        Our app does not keep a separate record of what is sent to the language model or of what it
        answers, apart from his lines listed above.
      </p>

      <h2>Who stores it</h2>
      <p>Your account and your data are stored with Supabase. The app is served by Vercel.</p>
      <p>
        Both services keep their own technical records, such as your IP address, when you signed in
        and which pages were requested. Deleting your account does not remove those records; each
        service keeps them under its own terms.
      </p>

      <h2>Your choices</h2>
      <p>
        You can download everything your account holds with{" "}
        <Link href="/me/export">Export my data</Link>. You can delete your account and everything in
        it with <Link href="/me/delete-account">Delete my data</Link>: that removes your account and
        everything listed under &ldquo;What we keep on our server&rdquo;. Deleting cannot be undone.
      </p>

      <h2>Changes</h2>
      <p>When this notice changes, the date at the top changes.</p>
    </article>
  );
}
