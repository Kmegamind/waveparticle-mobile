import { describe, expect, it } from "vitest";
import { checkProvider } from "../scripts/provider-check.mjs";

const fake = (fn: () => Promise<unknown>) => fn as unknown as typeof fetch;
const answer = (status: number) =>
  fake(async () => ({ ok: status >= 200 && status < 300, status }));

describe("checkProvider", () => {
  it("is OK when the provider accepts the key", async () => {
    const result = await checkProvider("deepseek", { DEEPSEEK_API_KEY: "k" }, answer(200));
    expect(result.ok).toBe(true);
  });

  it("explains a missing key without calling the network", async () => {
    let called = false;
    const result = await checkProvider(
      "gemini",
      {},
      fake(async () => {
        called = true;
        return { ok: true, status: 200 };
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/GEMINI_API_KEY is missing/);
    expect(called).toBe(false);
  });

  it("reports a rejected key", async () => {
    const result = await checkProvider("deepseek", { DEEPSEEK_API_KEY: "k" }, answer(401));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/rejected/);
  });

  it("reports an unexpected answer with its status", async () => {
    const result = await checkProvider("gemini", { GEMINI_API_KEY: "k" }, answer(404));
    expect(result.reason).toMatch(/status 404/);
  });

  it("reports an unreachable provider", async () => {
    const result = await checkProvider(
      "gemini",
      { GEMINI_API_KEY: "k" },
      fake(async () => {
        throw new Error("offline");
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could not reach/);
  });

  it("never puts the key in the result", async () => {
    const result = await checkProvider("deepseek", { DEEPSEEK_API_KEY: "secret-123" }, answer(401));
    expect(JSON.stringify(result)).not.toContain("secret-123");
  });
});
