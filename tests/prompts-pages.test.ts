import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #308 AC1, AC5, AC6: the ADM-08 Prompts pages exist in the admin, read through the signed-in
// user's own client, and Publish history reaches the prompt roll back.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const FILES = [
  "src/app/admin/prompts/page.tsx",
  "src/app/admin/prompts/[key]/page.tsx",
  "src/app/admin/prompts/[key]/prompt-editor.tsx",
  "src/app/admin/prompts/actions.ts",
  "src/lib/prompts/admin.ts",
];

describe("ADM-08 Prompts pages (#308)", () => {
  it("test_308_ac1_menu_lists_prompts_as_adm_08_under_ai_rules", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    expect(shell).toContain('heading: "AI rules"');
    expect(shell).toContain('{ href: "/admin/prompts", id: "ADM-08", label: "Prompts" }');
    expect(shell.indexOf('"AI rules"')).toBeLessThan(shell.indexOf('"Review and logs"'));
    expect(shell.indexOf('"AI rules"')).toBeGreaterThan(shell.indexOf('heading: "Content"'));
  });

  it("test_308_pages_read_through_the_signed_in_users_own_client", () => {
    for (const file of ["src/app/admin/prompts/page.tsx", "src/app/admin/prompts/[key]/page.tsx"]) {
      const page = read(file);
      expect(page, file).toContain("createSupabaseServerClient()");
      expect(page, file).toContain("readPromptVersions(");
    }
    expect(read("src/lib/prompts/admin.ts")).toContain('rpc("list_prompt_versions", {})');
  });

  it("test_308_ac5_actions_check_the_account_and_role_on_the_server", () => {
    const actions = read("src/app/admin/prompts/actions.ts");
    expect(actions.startsWith('"use server";')).toBe(true);
    expect(actions).toContain("getCurrentUser(client)");
    expect(actions).toContain("readContentRole(client)");
    expect(actions).toContain("writePrompt(");
  });

  it("test_308_no_service_role_key", () => {
    for (const file of FILES) expect(read(file), file).not.toMatch(/service_role|SERVICE_ROLE/);
  });

  it("test_308_publish_history_wires_the_prompt_roll_back", () => {
    const actions = read("src/app/admin/publish-history/actions.ts");
    expect(actions).toContain("rollBackPromptAction");
    expect(actions).toMatch(/prompt: async \(itemKey, itemVersion\)/);
  });

  it("test_308_ac4_diff_lines_carry_their_kind_in_text", () => {
    const editor = read("src/app/admin/prompts/[key]/prompt-editor.tsx");
    expect(editor).toContain('const MARK = { same: " ", added: "+", removed: "−" } as const;');
    expect(editor).toContain(
      'const SPOKEN = { same: "Unchanged", added: "Added", removed: "Removed" } as const;',
    );
  });
});

describe("ADM-12 roll back of a prompt (#308 review)", () => {
  it("test_308_ac7_history_roll_back_keeps_the_reasons", () => {
    const actions = read("src/app/admin/publish-history/actions.ts");
    expect(actions).toContain("problems: result.problems");
    const button = read("src/app/admin/publish-history/roll-back-button.tsx");
    expect(button).toMatch(/problems\.map\(/);
    expect(read("src/lib/publish-history/admin.ts")).toMatch(
      /\{ ok: false; error: string; problems\?: string\[\] \}/,
    );
  });
});
