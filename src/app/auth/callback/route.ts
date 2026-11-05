import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function getSafeNextPath(next: string | null): string {
  return next && next.startsWith("/") && next[1] !== "/" && next[1] !== "\\" ? next : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/auth/sign-in?error=confirmation_failed", request.url));
    }
  }

  return NextResponse.redirect(new URL(getSafeNextPath(next), request.url));
}
