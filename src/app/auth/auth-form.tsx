"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { helpLineStorage, removeHelpLineCopy } from "@/lib/safety/help-lines";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "update-password";

// Wording of prototype v4 (#262, #229 to #232). The actions behind each button are unchanged.
const copy: Record<AuthMode, { title: string; submit: string; lead?: string; password: string }> = {
  "sign-in": {
    title: "Sign in",
    submit: "Sign in",
    lead: "An account keeps your Goals and Steps on every device.",
    password: "Password",
  },
  "sign-up": { title: "Create an account", submit: "Create account", password: "Password" },
  "forgot-password": {
    title: "Forgot your password",
    submit: "Send link",
    lead: "Enter your email. We will send a link to choose a new password.",
    password: "Password",
  },
  "update-password": {
    title: "Choose a new password",
    submit: "Save password",
    password: "New password",
  },
};

const hasBackRow = (mode: AuthMode) => mode === "sign-up" || mode === "forgot-password";

export function AuthForm({ mode, notice = "" }: { mode: AuthMode; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(notice);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();

    try {
      if (mode === "sign-in") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.push("/");
      } else if (mode === "sign-up") {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        setMessage("Check your email to confirm your account before signing in.");
      } else if (mode === "forgot-password") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        });
        if (authError) throw authError;
        setMessage("Check your email for a password reset link.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Your password was updated. You can sign in now.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-body">
        {hasBackRow(mode) ? (
          <div className="auth-back">
            <Link aria-label="Back to Sign in" className="auth-back-link" href="/auth/sign-in">
              <span aria-hidden="true">‹</span>
            </Link>
            <span aria-hidden="true" className="auth-back-label">
              Sign in
            </span>
          </div>
        ) : null}
        <h1>
          {mode === "update-password" ? (
            // The prototype breaks this title after "a".
            <>
              Choose a <span className="auth-title-line">new password</span>
            </>
          ) : (
            copy[mode].title
          )}
        </h1>
        {copy[mode].lead ? (
          <p className={mode === "forgot-password" ? "auth-lead auth-lead-spaced" : "auth-lead"}>
            {copy[mode].lead}
          </p>
        ) : null}
        <form onSubmit={submit}>
          {mode !== "update-password" && (
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
          )}
          {mode !== "forgot-password" && (
            <label>
              {copy[mode].password}
              <input
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
          )}
          <button className="button-filled" disabled={pending} type="submit">
            {copy[mode].submit}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        <AuthLinks mode={mode} />
      </div>
    </main>
  );
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  if (mode === "sign-in") {
    return (
      <div className="auth-links">
        <p>
          <Link href="/auth/forgot-password">Forgot your password?</Link>
        </p>
        <p>
          <span className="auth-caption">New here?</span>{" "}
          <Link href="/auth/sign-up">Create an account</Link>
        </p>
        <p>
          <Link href="/privacy">Privacy notice</Link>
        </p>
      </div>
    );
  }
  if (mode === "sign-up") {
    return (
      <p className="auth-privacy">
        What is stored and what is sent to the language model:{" "}
        <Link href="/privacy">Privacy notice</Link>
      </p>
    );
  }
  return null;
}

export function SignOutButton({ className = "button-filled" }: { className?: string } = {}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  async function signOut() {
    // #118 (SAFETY-REGION-STORE): the help line copy goes at sign out.
    removeHelpLineCopy(helpLineStorage());
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <button className={className} onClick={signOut} type="button">
      Sign out
    </button>
  );
}
