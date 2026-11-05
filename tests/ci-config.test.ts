describe("CI container", () => {
  it("uses a Playwright image that matches the installed Playwright version", () => {
    const version = JSON.parse(read("package.json")).devDependencies["@playwright/test"];
    expect(read(".github/workflows/ci.yml")).toContain(
      `mcr.microsoft.com/playwright:v${version}-noble`,
    );
  });

  it("gives every job a time limit", () => {
    const ci = read(".github/workflows/ci.yml");
    expect((ci.match(/timeout-minutes:/g) ?? []).length).toBe(2);
  });
});
