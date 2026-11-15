import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway } from "@/lib/model-gateway";
import { GATEWAY_PROMPT_CASES, recordGatewayPrompts } from "./support/gateway-prompt-cases";
import { seedPromptSource } from "./support/seed-prompts";

// #282: the prompts moved to the database. With the seed loaded, the gateway builds exactly the
// prompts it built before (tests/fixtures/gateway-prompts.json was recorded from the old code).

const golden = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "fixtures", "gateway-prompts.json"), "utf8"),
) as Record<string, string[]>;

describe("gateway prompts from the seed (#282)", () => {
  it("test_282_same_prompts_every_case_is_in_the_golden_file", () => {
    expect(Object.keys(golden).sort()).toEqual(GATEWAY_PROMPT_CASES.map((c) => c.name).sort());
  });

  it("test_282_same_prompts_the_seed_builds_every_prompt_and_retry_exactly_as_before", async () => {
    const recorded = await recordGatewayPrompts((provider) =>
      createModelGateway({ provider, prompts: seedPromptSource(), timeLimitMs: 60_000 }),
    );
    for (const name of Object.keys(golden)) {
      expect(recorded[name], name).toEqual(golden[name]);
    }
  });
});
