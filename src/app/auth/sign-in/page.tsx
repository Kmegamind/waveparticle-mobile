import { signInNotice } from "@/lib/account/delete-account";
import { AuthForm } from "../auth-form";

export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  return <AuthForm mode="sign-in" notice={signInNotice(await searchParams)} />;
}
