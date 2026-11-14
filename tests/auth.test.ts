import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "@/app/auth/callback/route";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

async function readWorkspaceFile(fileName: string): Promise<string> {
  return readFile(`${workspaceRoot}${fileName}`, "utf8");
}

describe("authentication flow", () => {
  it("defines the public auth screens", async () => {
    const files = await Promise.all(
      [
        "src/app/auth/sign-in/page.tsx",
        "src/app/auth/sign-up/page.tsx",
        "src/app/auth/forgot-password/page.tsx",
        "src/app/auth/update-password/page.tsx",
      ].map(readWorkspaceFile),
    );

    for (const file of files) expect(file).toContain("AuthForm");
    expect(await readWorkspaceFile("src/app/auth/auth-form.tsx")).toContain("<h1>");
  });

  it("uses Supabase browser auth for the required actions", async () => {
    const auth = await readWorkspaceFile("src/app/auth/auth-form.tsx");

    expect(auth).toContain("signUp");
    expect(auth).toContain("signInWithPassword");
    expect(auth).toContain("resetPasswordForEmail");
    expect(auth).toContain("updateUser");
    expect(auth).toContain("signOut");
    expect(auth).toContain("Check your email");
  });

  it("refreshes the Supabase session in the Next.js proxy", async () => {
    const [proxy, session] = await Promise.all([
      readWorkspaceFile("src/proxy.ts"),
      readWorkspaceFile("src/lib/supabase/session.ts"),
    ]);

    expect(proxy).toContain("updateSession");
    expect(proxy).toContain("matcher");
    expect(session).toContain("getUser");
  });

  it("allows only same-site callback destinations", () => {
    expect(getSafeNextPath("/auth/update-password")).toBe("/auth/update-password");
    expect(getSafeNextPath("//evil.example")).toBe("/");
    expect(getSafeNextPath("/\\evil.example")).toBe("/");
    expect(getSafeNextPath("https://evil.example")).toBe("/");
  });

  it("handles failed callback exchanges with a sign-in error", async () => {
    const callback = await readWorkspaceFile("src/app/auth/callback/route.ts");

    expect(callback).toContain("exchangeCodeForSession(code)");
    expect(callback).toContain("confirmation_failed");
  });

  it("uses the callback route for password reset links", async () => {
    const auth = await readWorkspaceFile("src/app/auth/auth-form.tsx");

    expect(auth).toContain("/auth/callback?next=/auth/update-password");
  });

  it("configures harmless Supabase placeholders for Playwright", async () => {
    const config = await readWorkspaceFile("playwright.config.ts");

    expect(config).toContain("playwright-placeholder");
    // #73: the e2e app talks only to the local, test-only stub (e2e/support/stub-supabase.mjs),
    // never to a real Supabase project.
    expect(config).toMatch(
      /NEXT_PUBLIC_SUPABASE_URL: `http:\/\/127\.0\.0\.1:\$\{supabaseStubPort\}`/,
    );
    expect(config).toContain('command: "node e2e/support/stub-supabase.mjs"');
    expect(config).not.toMatch(/supabase\.co/);
  });

  it("returns a clear proxy configuration error", async () => {
    const proxy = await readWorkspaceFile("src/proxy.ts");

    expect(proxy).toContain("NextResponse.json");
    expect(proxy).toContain("Supabase configuration is missing.");
  });

  it("protects the product route without adding application storage", async () => {
    const page = await readWorkspaceFile("src/app/page.tsx");

    expect(page).toContain("getCurrentUser");
    expect(page).toContain('redirect("/auth/sign-in")');
    expect(page).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});
