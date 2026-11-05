"use client";

import { SignOutButton } from "./auth/auth-form";

export function ProtectedHome({ email, goalTitles }: { email: string; goalTitles: string[] }) {
  return (
    <main className="app-screen">
      <h1>Home</h1>
      <p>{email}</p>
      {goalTitles.length > 0 ? (
        <ul>
          {goalTitles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      ) : null}
      <SignOutButton />
    </main>
  );
}
