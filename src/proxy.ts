import { NextResponse, type NextRequest } from "next/server";
import { isPrototypeEnabled, tryPathIsHidden } from "./lib/prototype/config";
import { updateSession } from "./lib/supabase/session";

export async function proxy(request: NextRequest) {
  // The sign-in-free test path exists only when PROTOTYPE_ENABLED is 1 (#208).
  if (tryPathIsHidden(request.nextUrl.pathname, isPrototypeEnabled())) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    return await updateSession(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase configuration is missing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
