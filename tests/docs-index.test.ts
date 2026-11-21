import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

  it("test_335_every_checked_link_in_the_repository_resolves", () => {
    expect(docsIndex.brokenLinks(root, docsIndex.LINK_FOLDERS, docsIndex.linkFiles(root))).toEqual(
      docsIndex.LINK_ALLOWLIST,
    );
  });

  it("test_335_link_check_covers_readme_spec_map_pr_template_and_top_level_docs", () => {
    const dir = fixture({
      "README.md": "[gone](docs/gone.md)\n",
      "docs/SPEC_MAP.md": "[ok](TOP.md)\n",
      "docs/api/a.md": "# A\n",
      "docs/architecture/a.md": "# A\n",
      "docs/TOP.md": "[gone](gone.md)\n",
      ".github/pull_request_template.md": "[gone](../docs/gone.md)\n",
    });
    const broken = docsIndex.brokenLinks(dir, docsIndex.LINK_FOLDERS, docsIndex.linkFiles(dir));
    expect(broken.map((b: { file: string }) => b.file).sort()).toEqual([
      ".github/pull_request_template.md",
      "README.md",
      "docs/TOP.md",
    ]);
  });

  it("test_335_docs_paths_named_in_source_comments_exist", () => {
    const dir = fixture({
      "src/p.tsx": "// see (docs/api/there.md) and docs/api/missing.md.\n",
      "docs/api/there.md": "# There\n",
    });
    expect(docsIndex.brokenDocPaths(dir, ["src/p.tsx"])).toEqual([
      { file: "src/p.tsx", link: "docs/api/missing.md" },
    ]);
    expect(docsIndex.brokenDocPaths(root, docsIndex.DOC_PATH_FILES)).toEqual([]);
    expect(docsIndex.DOC_PATH_FILES).toContain("src/app/try/focus/page.tsx");
  });

  it("test_335_check_flags_duplicate_or_out_of_order_index_lines", () => {
    const dir = fixture({
      "docs/api/README.md": README,
      "docs/api/a.md": "# A\n\nA.\n",
      "docs/api/b.md": "# B\n\nB.\n",
    });
    docsIndex.syncIndex(dir, "docs/api", { write: true });
    const readme = path.join(dir, "docs/api/README.md");
    const good = readFileSync(readme, "utf8");
    expect(docsIndex.indexProblems(dir, "docs/api")).toEqual([]);

    const a = "- [A](a.md): A.";
    const b = "- [B](b.md): B.";
    writeFileSync(readme, good.replace(`${a}\n${b}`, `${a}\n${a}\n${b}`));
    expect(docsIndex.indexProblems(dir, "docs/api").join()).toContain("duplicate");
    writeFileSync(readme, good.replace(`${a}\n${b}`, `${b}\n${a}`));
    expect(docsIndex.indexProblems(dir, "docs/api").join()).toContain("out of order");
    // A union merge can also leave a stale index; --check must still exit 1.
    writeFileSync(readme, good.replace(`${a}\n${b}`, `${a}\n${a}\n${b}`));
    const script = path.join(root, "scripts/docs-index.mjs");
    expect(() => execFileSync("node", [script, "--check", dir], { stdio: "pipe" })).toThrow();
  });

  it("test_335_gitattributes_uses_union_merge_for_both_index_files", () => {
    const attrs = readFileSync(path.join(root, ".gitattributes"), "utf8");
    expect(attrs).toMatch(/^docs\/api\/README\.md\s+merge=union$/m);
    expect(attrs).toMatch(/^docs\/architecture\/README\.md\s+merge=union$/m);
  });

  it("test_335_two_branches_adding_files_in_the_same_gap_merge_without_conflict", () => {
    const git = (cwd: string, ...args: string[]) =>
      execFileSync(
        "git",
        [
          "-c",
          "user.name=t",
          "-c",
          "user.email=t@example.com",
          "-c",
          "commit.gpgsign=false",
          ...args,
        ],
        { cwd, stdio: "pipe", encoding: "utf8" },
      );
    const dir = fixture({
      "docs/api/README.md": README,
      "docs/api/a.md": "# A\n\nA.\n",
      "docs/api/z.md": "# Z\n\nZ.\n",
      ".gitattributes": readFileSync(path.join(root, ".gitattributes"), "utf8"),
    });
    const script = path.join(root, "scripts/docs-index.mjs");
    const regenerate = () => execFileSync("node", [script, dir], { stdio: "pipe" });
    const addFile = (name: string, title: string) => {
      writeFileSync(path.join(dir, `docs/api/${name}`), `# ${title}\n\n${title}.\n`);
      regenerate();
      git(dir, "add", "-A");
      git(dir, "commit", "-m", `add ${name}`);
    };
    // Only docs/api exists in this fixture, so point the script at it.
    git(dir, "init", "-b", "main");
    regenerate();
    git(dir, "add", "-A");
    git(dir, "commit", "-m", "base");
    git(dir, "checkout", "-b", "one");
    addFile("clock-a.md", "Clock A");
    git(dir, "checkout", "main");
    git(dir, "checkout", "-b", "two");
    addFile("clock-b.md", "Clock B");
    git(dir, "merge", "one", "--no-edit");
    // Git keeps both lines but may put them in the wrong order. --check must then say so
    // (and never report a duplicate), and running the script again fixes it.
    const check = () => {
      try {
        execFileSync("node", [script, "--check", dir], { stdio: "pipe" });
        return "";
      } catch (error) {
        return String((error as { stdout: Buffer }).stdout);
      }
    };
    const afterMerge = check();
    expect(afterMerge).not.toContain("duplicate");
    if (afterMerge) expect(afterMerge).toContain("out of order");
    regenerate();
    expect(check()).toBe("");
    const merged = readFileSync(path.join(dir, "docs/api/README.md"), "utf8");
    expect(merged).toContain("(clock-a.md)");
    expect(merged).toContain("(clock-b.md)");
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
