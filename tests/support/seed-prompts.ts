import path from "node:path";
import type { CompanionKind } from "@/lib/model-gateway/types";
import type { LineLimits, PlanLimits } from "@/lib/model-gateway/checks";
import type { PromptRow, PromptSource } from "@/lib/prompts/repository";
import { readPromptDirectory } from "../../scripts/prompts/prompt-files.mjs";

// The seed prompts (docs/ai/prompts) as the gateway's prompt source in tests (#282), exactly as
// they are loaded into the table.

const seedDirectory = path.join(import.meta.dirname, "..", "..", "docs", "ai", "prompts");

export function seedRows(): PromptRow[] {
  return readPromptDirectory(seedDirectory).map(
    (row) =>
      ({ key: row.key, version: row.version, body: row.body, params: row.params }) as PromptRow,
  );
}

export function seedPromptSource(): PromptSource {
  const rows = seedRows();
  return async (key) => rows.find((row) => row.key === key) ?? null;
}

type Checks = Record<string, unknown>;
const checksOf = (key: string) =>
  seedRows().find((row) => row.key === key)?.params.checks as Checks;

/** The seed's length limits for one kind of line, as the gateway passes them to the checks. */
export function seedLineLimits(kind: CompanionKind): LineLimits {
  if (kind === "step_card") return checksOf("step_cards").step_card as LineLimits;
  if (kind === "background_card") return checksOf("step_cards").background_card as LineLimits;
  if (kind === "stuck_story") return checksOf("stuck_story") as LineLimits;
  if (kind === "rest_reply") return checksOf("rest_reply") as LineLimits;
  if (kind === "return_popup") return checksOf("return_popup") as LineLimits;
  return checksOf("closing_line") as LineLimits;
}

export function seedPlanLimits(): PlanLimits {
  return checksOf("plan_split") as PlanLimits;
}
