// Prints OK or FAIL for each model provider key in .env. Never prints a key or a response.
import { PROVIDERS, checkProvider } from "./provider-check.mjs";

let failed = false;
for (const id of Object.keys(PROVIDERS)) {
  const result = await checkProvider(id, process.env);
  const label = PROVIDERS[id].label;
  console.log(
    `${result.ok ? "OK  " : "FAIL"} ${label}: ${result.reason}${result.ms ? ` (${result.ms} ms)` : ""}`,
  );
  if (!result.ok) failed = true;
}
process.exit(failed ? 1 : 0);
