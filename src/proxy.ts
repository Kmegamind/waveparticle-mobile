import { NextResponse, type NextRequest } from "next/server";
import {
  accountSessionPathIsHidden,
  isPrototypeEnabled,
  tryPathIsHidden,
} from "./lib/prototype/config";
import { updateSession } from "./lib/supabase/session";

export async function proxy(request: NextRequest) {
  // The sign-in-free test path exists only when PROTOTYPE_ENABLED is 1 (#208).
  // The signed-in /goal, /focus and /rest (#32, #257) are hidden with it until the per-account
  // daily cap on model calls (#256) lands.
  const enabled = isPrototypeEnabled();
  const pathname = request.nextUrl.pathname;
  if (tryPathIsHidden(pathname, enabled) || accountSessionPathIsHidden(pathname, enabled)) {
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
