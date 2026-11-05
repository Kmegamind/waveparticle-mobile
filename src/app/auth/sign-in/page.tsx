import { AuthForm } from "../auth-form";

export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthForm
      mode="sign-in"
      notice={error === "confirmation_failed" ? "This link is invalid or expired." : undefined}
    />
  );
}
