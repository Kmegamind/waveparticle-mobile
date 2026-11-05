"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "update-password";

const copy: Record<AuthMode, { title: string; submit: string }> = {
  "sign-in": { title: "Sign in", submit: "Sign in" },
  "sign-up": { title: "Create an account", submit: "Create account" },
  "forgot-password": { title: "Reset your password", submit: "Send reset email" },
  "update-password": { title: "Choose a new password", submit: "Update password" },
};

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
      <h1>{copy[mode].title}</h1>
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
            Password
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
    </main>
  );
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  if (mode === "sign-in") {
    return (
      <p>
        <Link href="/auth/sign-up">Create an account</Link>
        {" · "}
        <Link href="/auth/forgot-password">Reset your password</Link>
      </p>
    );
  }
  if (mode === "sign-up" || mode === "forgot-password") {
    return (
      <p>
        <Link href="/auth/sign-in">Sign in</Link>
      </p>
    );
  }
  return null;
}

export function SignOutButton() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <button className="button-filled" onClick={signOut} type="button">
      Sign out
    </button>
  );
}
