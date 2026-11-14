"use client";

import { SignOutButton } from "./auth/auth-form";
import { ContinueLink } from "./continue-link";

export type HomeGoal = { id: string; title: string; continueHref: string | null };

export function ProtectedHome({ email, goals }: { email: string; goals: HomeGoal[] }) {
  return (
    <main className="app-screen">
      <h1>Home</h1>
      <p>{email}</p>
      {goals.length > 0 ? (
        <ul>
          {goals.map((goal) => (
            <li key={goal.id}>
              {goal.title}
              {goal.continueHref ? (
                <>
                  {" "}
                  <ContinueLink href={goal.continueHref} />
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <SignOutButton />
    </main>
  );
}
