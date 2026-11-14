import { SignOutButton } from "../auth/auth-form";

// Sign out moved here from the placeholder Home when Home followed prototype v4 (#268).
export default function Me() {
  return (
    <main className="app-screen">
      <h1>Me</h1>
      <SignOutButton />
    </main>
  );
}
