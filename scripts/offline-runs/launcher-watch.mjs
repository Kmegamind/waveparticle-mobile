// Vitest global setup for the offline runs (#420): watches a pipe from the launcher (run.mjs).
// run.mjs holds the write end as file descriptor 3 of the runner. When run.mjs ends in any way,
// even killed and left unreaped by its own parent (a zombie, which still answers a pid check), the
// operating system closes its end and this side reads end-of-file. The watch then writes the stop
// file, and the runner stops after the units in flight and writes the partial report.
import { rmSync } from "node:fs";
import net from "node:net";
import { writeStopFile } from "./stop-file.mjs";

/** Must match LAUNCHER_GONE in src/lib/offline-runs/run.ts. */
const LAUNCHER_GONE = "launcher gone";

export default function setup() {
  const fd = Number(process.env.OFFLINE_RUN_LAUNCHER_FD);
  const stopFile = process.env.OFFLINE_RUN_STOP_FILE;
  if (!Number.isInteger(fd) || fd < 3 || !stopFile) return undefined;
  let pipe;
  try {
    pipe = new net.Socket({ fd, readable: true, writable: false });
  } catch {
    return undefined;
  }
  let done = false;
  const gone = () => {
    if (done) return;
    done = true;
    try {
      writeStopFile(stopFile, LAUNCHER_GONE);
    } catch {
      // The run also watches the launcher's pid.
    }
  };
  pipe.on("end", gone);
  pipe.on("close", gone);
  pipe.on("error", gone);
  pipe.resume();
  pipe.unref();
  return () => {
    done = true;
    pipe.destroy();
    // The run removes the stop file when it ends, but it can see the launcher's pid gone and finish
    // before this process reads the pipe's end and writes the file (#428). This teardown runs in the
    // same process as that write and after the run, so the file never outlives the runner.
    try {
      rmSync(stopFile, { force: true });
    } catch {
      // Nothing to remove.
    }
  };
}
