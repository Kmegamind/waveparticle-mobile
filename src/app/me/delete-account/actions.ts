"use server";

import { redirect } from "next/navigation";
import { deleteAccount } from "@/lib/account/delete-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/** ACCOUNT-DELETE (#103): deletes the signed-in account, signs out and opens Sign in. */
export async function deleteAccountAction(): Promise<{ status: "failed" | "signed-out" }> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const outcome = await deleteAccount({
    userId: user?.id ?? null,
    rpc: () => client.rpc("delete_my_account"),
    signOut: () => client.auth.signOut(),
  });
  if (outcome.status === "deleted") redirect("/auth/sign-in?deleted=1");
  return { status: outcome.status };
}
