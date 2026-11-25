// The confirmation of a real offline run (#42): only the literal command-line flag `--confirm`
// opens the real model. Nothing in the environment or in .env can: the launcher removes every
// inherited OFFLINE_RUN_* setting, and for `--confirm` it writes a random token to a private file
// that the runner must find and match. Reading it deletes the file, so a token opens one run only.
// A value of OFFLINE_RUN_CONFIRM alone (from the shell or .env) has no matching file and is refused.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const CONFIRM_ENV = "OFFLINE_RUN_CONFIRM";
export const CONFIRM_FILE_ENV = "OFFLINE_RUN_CONFIRM_FILE";
const FILE_PREFIX = "wp-offline-run-confirm-";

/**
 * The child's environment: the parent's without any OFFLINE_RUN_* setting, then the flags' settings.
 * @param {Record<string, string | undefined>} parentEnv
 * @param {Record<string, string>} settings
 */
export function childEnv(parentEnv, settings) {
  const env = Object.fromEntries(
    Object.entries(parentEnv).filter(([name]) => !name.startsWith("OFFLINE_RUN_")),
  );
  return { ...env, ...settings };
}

/**
 * Writes a one-time token for `--confirm`. Returns the two settings and a cleanup function.
 * @returns {{ settings: Record<string, string>, cleanup: () => void }}
 */
export function issueConfirmation(directory = tmpdir()) {
  const token = randomBytes(32).toString("hex");
  const file = path.join(directory, `${FILE_PREFIX}${token.slice(0, 12)}`);
  writeFileSync(file, token, { mode: 0o600 });
  return {
    settings: { [CONFIRM_ENV]: token, [CONFIRM_FILE_ENV]: file },
    cleanup: () => rmSync(file, { force: true }),
  };
}

/**
 * True only when the launcher issued a token for `--confirm` in this run. The file is deleted when
 * it is read, whatever the answer, so the same token never opens a second run.
 * @param {Record<string, string | undefined>} env
 */
export function confirmationGiven(env) {
  const token = env[CONFIRM_ENV] ?? "";
  const file = env[CONFIRM_FILE_ENV] ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  if (!path.basename(file).startsWith(FILE_PREFIX) || !existsSync(file)) return false;
  try {
    return readFileSync(file, "utf8") === token;
  } catch {
    return false;
  } finally {
    rmSync(file, { force: true });
  }
}
