// The stop file of an offline run (#420): written atomically, so the runner never reads it half
// written. The text goes to a temporary file in the same folder, which is then renamed into place
// (a rename within one folder is atomic).
import { renameSync, writeFileSync } from "node:fs";

/**
 * @param {string} file
 * @param {string} text
 */
export function writeStopFile(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, file);
}
