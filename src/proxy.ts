import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/session";

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase configuration is missing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
