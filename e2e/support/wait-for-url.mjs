// Waits until a URL answers, so the live e2e app starts after the first app has been built.
const url = process.argv[2];
for (let tries = 0; tries < 600; tries += 1) {
  try {
    await fetch(url);
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
process.exit(1);
