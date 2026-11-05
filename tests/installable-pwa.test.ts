import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

async function readWorkspaceFile(fileName: string): Promise<string> {
  return readFile(`${workspaceRoot}${fileName}`, "utf8");
}

function block(css: string, selector: string): string {
  const match = css.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`));
  return match?.[0] ?? "";
}

describe("US-PLAT-1 installable web app that fits a phone", () => {
  it("can be installed with a name, an icon and a standalone window", async () => {
    const manifest = await readWorkspaceFile("src/app/manifest.ts");
    const layout = await readWorkspaceFile("src/app/layout.tsx");
    const proxy = await readWorkspaceFile("src/proxy.ts");

    expect(manifest).toContain('name: "WaveParticle"');
    expect(manifest).toContain('short_name: "WaveParticle"');
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('start_url: "/"');
    expect(manifest).toContain('sizes: "192x192"');
    expect(manifest).toContain('sizes: "512x512"');
    expect(manifest).toContain('type: "image/png"');

    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).toContain("capable: true");
    expect(layout).toContain('title: "WaveParticle"');
    expect(layout).toContain('"apple-mobile-web-app-capable": "yes"');

    expect(proxy).toContain("manifest.webmanifest");

    for (const icon of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/apple-touch-icon.png",
    ]) {
      const bytes = await readFile(`${workspaceRoot}${icon}`);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });

  it("fits a portrait phone and respects safe areas on every screen", async () => {
    const css = await readWorkspaceFile("src/app/globals.css");
    const tokens = await readWorkspaceFile("src/app/tokens.css");

    expect(tokens).toContain("--layout-phone-max: 26.875rem");
    expect(css).toContain("overflow-x: clip");
    for (const inset of ["top", "right", "bottom", "left"]) {
      expect(css).toContain(`env(safe-area-inset-${inset})`);
    }

    const screens = [
      "src/app/protected-home.tsx",
      "src/app/companions/page.tsx",
      "src/app/goals/page.tsx",
      "src/app/me/page.tsx",
      "src/app/auth/auth-form.tsx",
    ];
    for (const screen of screens) {
      const source = await readWorkspaceFile(screen);
      expect(source).toMatch(/app-screen|auth-page/);
    }
  });

  it("keeps the phone column on a wider screen", async () => {
    const css = await readWorkspaceFile("src/app/globals.css");

    expect(block(css, ".app-shell")).toContain("max-width: var(--layout-phone-max)");
    expect(block(css, ".app-tab-bar")).toContain("max-width: var(--layout-phone-max)");
    expect(css).not.toMatch(/@media\s*\([^)]*min-width:\s*(4[3-9]\d|[5-9]\d{2}|\d{4,})px/);
  });
});
