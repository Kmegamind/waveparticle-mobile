import { NextResponse } from "next/server";
import { HELP_LINE_RESET_COOKIE } from "@/lib/safety/help-lines";
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
    // #118 (review of #406, M-B): a new session was set, so the phone's help line copy (perhaps
    // another account's) is cleared on the next page, before the first refresh writes this one's.
    const response = NextResponse.redirect(new URL(getSafeNextPath(next), request.url));
    response.cookies.set(HELP_LINE_RESET_COOKIE, "1", { path: "/", maxAge: 300, sameSite: "lax" });
    return response;
  }

  return NextResponse.redirect(new URL(getSafeNextPath(next), request.url));
}
