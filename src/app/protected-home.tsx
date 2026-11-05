"use client";

import { SignOutButton } from "./auth/auth-form";

export function ProtectedHome({ email }: { email: string }) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-[var(--space-small-gap)] px-[var(--space-screen-inline)]">
      <h1 className="font-[var(--type-display)] text-[var(--text-display-size)] leading-[var(--text-display-leading)] font-extrabold">
        WaveParticle
      </h1>
      <p>{email}</p>
      <SignOutButton />
    </main>
  );
}
