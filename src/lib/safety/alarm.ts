import type { ClassifierFailureReason } from "./classifier";

/**
 * The same-day alarm when the safety classifier fails or times out (US-SAF-4 #117 AC3; owner
 * decision of 2026-11-22, SAFETY-ALARM). A POST to the server-only `SAFETY_ALARM_WEBHOOK_URL`, at
 * most once a day (UTC), carrying the day and the day's count of classifier failures so far.
 *
 * The payload is built only from the date, a count and a fixed reason identifier: never any text a
 * person wrote. Without the setting, nothing is posted and nothing throws.
 *
 * "Once a day" is shared by every server instance through `counter` (a database row per day). If
 * the counter cannot be reached, this instance decides on its own, so the alarm is still sent
 * (possibly once per instance) rather than lost.
 */

/** Counts one failure for `day` and says whether this is the first alarm of that day. */
export type FailureCounter = (day: string) => Promise<{ failures: number; sendAlarm: boolean }>;

export type AlarmLog = (event: {
  event: "safety_alarm_not_configured" | "safety_alarm_failed";
}) => void;

export type SafetyAlarm = { classifierFailed(reason: ClassifierFailureReason): Promise<void> };

/** How long the webhook may take before it is given up. */
export const ALARM_TIMEOUT_MS = 5_000;

const utcDay = () => new Date().toISOString().slice(0, 10);

export function alarmText(day: string, failures: number, reason: ClassifierFailureReason): string {
  return (
    `WaveParticle safety alarm, ${day} (UTC): the safety classifier failed or timed out ` +
    `${failures} time(s) today so far, so the keyword layer decided alone. ` +
    `Latest reason: ${reason}. Check the server log for "safety_classifier_failed".`
  );
}

export function createSafetyAlarm(options: {
  webhookUrl: string | undefined;
  fetchImpl?: typeof fetch;
  counter?: FailureCounter | null;
  today?: () => string;
  log?: AlarmLog;
}): SafetyAlarm {
  const url = options.webhookUrl?.trim() ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const today = options.today ?? utcDay;
  const log = options.log ?? (() => undefined);
  // This instance's own count, used when the shared counter cannot be reached.
  const local = { day: "", failures: 0, sent: false };

  async function count(day: string): Promise<{ failures: number; sendAlarm: boolean }> {
    if (local.day !== day) Object.assign(local, { day, failures: 0, sent: false });
    local.failures += 1;
    if (options.counter) {
      try {
        const shared = await options.counter(day);
        if (shared.sendAlarm) local.sent = true;
        return shared;
      } catch {
        // Fall through to this instance's own decision.
      }
    }
    const sendAlarm = !local.sent;
    local.sent = true;
    return { failures: local.failures, sendAlarm };
  }

  return {
    async classifierFailed(reason) {
      if (!url) {
        log({ event: "safety_alarm_not_configured" });
        return;
      }
      try {
        const day = today();
        const { failures, sendAlarm } = await count(day);
        if (!sendAlarm) return;
        const text = alarmText(day, failures, reason);
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          // `text` for Slack-style hooks, `content` for Discord-style hooks.
          body: JSON.stringify({ text, content: text }),
          signal: AbortSignal.timeout(ALARM_TIMEOUT_MS),
        });
        await response.body?.cancel();
        if (!response.ok) log({ event: "safety_alarm_failed" });
      } catch {
        log({ event: "safety_alarm_failed" });
      }
    },
  };
}
