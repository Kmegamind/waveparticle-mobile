import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain script without types
import * as docsIndex from "../scripts/docs-index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "docs-index-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

const README = "# Things\nIntro.\n\n<!-- index:start -->\n<!-- index:end -->\n";

describe("docs index (#242)", () => {
  it("builds one line per file from its heading and first sentence, sorted by file name", () => {
    const dir = fixture({
      "docs/x/README.md": README,
      "docs/x/zeta.md": "# Zeta\n\nZeta does a thing. It also does more.\n",
      "docs/x/alpha.md": "# Alpha\n\nAlpha is first.\n",
    });
    const result = docsIndex.syncIndex(dir, "docs/x", { write: true });
    expect(result.changed).toBe(true);
    const text = readFileSync(path.join(dir, "docs/x/README.md"), "utf8");
    expect(text).toContain(
      "<!-- index:start -->\n- [Alpha](alpha.md): Alpha is first.\n- [Zeta](zeta.md): Zeta does a thing.\n<!-- index:end -->",
    );
    expect(text.startsWith("# Things\nIntro.\n")).toBe(true);
  });

  it("reports a stale index without writing, and adding a file makes it stale", () => {
    const dir = fixture({
      "docs/x/README.md": README,
      "docs/x/alpha.md": "# Alpha\n\nAlpha is first.\n",
    });
    docsIndex.syncIndex(dir, "docs/x", { write: true });
    expect(docsIndex.syncIndex(dir, "docs/x", { write: false }).changed).toBe(false);
    writeFileSync(path.join(dir, "docs/x/beta.md"), "# Beta\n\nBeta is new.\n");
    expect(docsIndex.syncIndex(dir, "docs/x", { write: false }).changed).toBe(true);
  });

  it("finds relative markdown links that point to a missing file", () => {
    const dir = fixture({
      "docs/x/a.md":
        "# A\n\n[ok](b.md) [anchor](b.md#top) [web](https://example.com) [gone](missing.md)\n```\n[fenced](nope.md)\n```\n",
      "docs/x/b.md": "# B\n",
    });
    expect(docsIndex.brokenLinks(dir, ["docs/x"])).toEqual([
      { file: "docs/x/a.md", link: "missing.md" },
    ]);
  });

  it("test_242_every_index_in_the_repository_is_up_to_date", () => {
    for (const folder of docsIndex.INDEXED_FOLDERS) {
      const result = docsIndex.syncIndex(root, folder, { write: false });
      expect(
        result.changed,
        `${folder}/README.md index is stale: run node scripts/docs-index.mjs`,
      ).toBe(false);
    }
  });

  it("test_242_no_relative_link_under_docs_api_or_docs_architecture_is_broken", () => {
    expect(docsIndex.brokenLinks(root, ["docs/api", "docs/architecture"])).toEqual([]);
  });

  it("test_242_old_paths_still_resolve", () => {
    expect(readFileSync(path.join(root, "docs/architecture.md"), "utf8")).toContain(
      "architecture/README.md",
    );
    expect(readFileSync(path.join(root, "docs/api/README.md"), "utf8")).toContain(
      "<!-- index:start -->",
    );
    expect(readFileSync(path.join(root, "docs/architecture/README.md"), "utf8")).toContain(
      "<!-- index:start -->",
    );
  });
});
