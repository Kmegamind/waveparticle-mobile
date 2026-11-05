"use client";

import { SignOutButton } from "./auth/auth-form";

export function ProtectedHome({ email }: { email: string }) {
  return (
    <main className="app-screen">
      <h1>Home</h1>
      <p>{email}</p>
      <SignOutButton />
    </main>
  );
}
