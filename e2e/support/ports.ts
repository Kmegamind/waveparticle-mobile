// The e2e ports (#269). Each can be set with an environment variable, so two sessions (two
// worktrees) can run `npm run test:e2e` at the same time. With no variables: 3100, 3101, 3199.

function envPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port number from 1 to 65535, got "${value}".`);
  }
  return port;
}

export const e2ePorts = {
  /** The app with no model (project "mobile"). */
  app: envPort("E2E_PORT", 3100),
  /** The app with the stub model (project "mobile-live"). */
  live: envPort("E2E_LIVE_PORT", 3101),
  /** The test-only stub model (e2e/support/stub-model.mjs). */
  stub: envPort("E2E_STUB_PORT", 3199),
};
