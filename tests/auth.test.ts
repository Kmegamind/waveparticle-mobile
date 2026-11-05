import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("protects the product route without adding application storage", async () => {
    const page = await readWorkspaceFile("src/app/page.tsx");

    expect(page).toContain("getCurrentUser");
    expect(page).toContain('redirect("/auth/sign-in")');
    expect(page).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});
