import { describe, expect, it, vi } from "vitest";
import { createSafetyAlarm, type FailureCounter } from "@/lib/safety/alarm";

// US-SAF-4 (#117) AC3: a failed or slow classifier raises an alarm the same day. Owner decision of
// 2026-11-22 (SAFETY-ALARM): a webhook to SAFETY_ALARM_WEBHOOK_URL, at most once a day, with the
// day's count of failures; never any user text.

const URL = "https://hooks.example.test/safety";

function webhook() {
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return { posts, fetchImpl };
}

/** A shared day counter, as the database keeps it for every server instance. */
function sharedCounter(): FailureCounter {
  const days = new Map<string, { failures: number; sent: boolean }>();
  return async (day) => {
    const row = days.get(day) ?? { failures: 0, sent: false };
    row.failures += 1;
    const sendAlarm = !row.sent;
    row.sent = true;
    days.set(day, row);
    return { failures: row.failures, sendAlarm };
  };
}

describe("#117 AC3 the same-day alarm", () => {
  it("test_117_i2_the_first_failure_of_the_day_posts_one_honest_webhook", async () => {
    const { posts, fetchImpl } = webhook();
    const alarm = createSafetyAlarm({
      webhookUrl: URL,
      fetchImpl,
      counter: sharedCounter(),
      today: () => "2026-11-22",
      now: () => new Date("2026-11-22T09:05:30Z"),
    });
    await alarm.classifierFailed("timeout");
    await alarm.classifierFailed("request");
    await alarm.classifierFailed("timeout");
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(URL);
    const text = String(posts[0].body.text);
    // Fix round 1 (I2): sent on the day's first failure, so it gives no count; it says where the
    // later failures of the day are.
    expect(text).toBe(
      "WaveParticle safety alarm: the first safety classifier failure today, 2026-11-22 at " +
        "09:05 UTC (reason: timeout). The keyword layer decided alone. Later failures today " +
        'are not sent here; they are in the server log as "safety_classifier_failed".',
    );
    expect(text).not.toMatch(/time\(s\)|so far/);
    expect(posts[0].body.content).toBe(text);
  });

  it("test_117_two_server_instances_still_send_one_alarm_a_day", async () => {
    const { posts, fetchImpl } = webhook();
    const counter = sharedCounter();
    const one = createSafetyAlarm({ webhookUrl: URL, fetchImpl, counter, today: () => "d1" });
    const two = createSafetyAlarm({ webhookUrl: URL, fetchImpl, counter, today: () => "d1" });
    await one.classifierFailed("timeout");
    await two.classifierFailed("timeout");
    expect(posts).toHaveLength(1);
  });

  it("test_117_a_new_day_sends_again", async () => {
    const { posts, fetchImpl } = webhook();
    let day = "2026-11-22";
    const alarm = createSafetyAlarm({
      webhookUrl: URL,
      fetchImpl,
      counter: sharedCounter(),
      today: () => day,
    });
    await alarm.classifierFailed("timeout");
    day = "2026-11-23";
    await alarm.classifierFailed("parse");
    expect(posts).toHaveLength(2);
    expect(String(posts[1].body.text)).toContain("2026-11-23");
  });

  it("test_117_when_the_shared_counter_fails_the_instance_still_sends_once_a_day", async () => {
    const { posts, fetchImpl } = webhook();
    const alarm = createSafetyAlarm({
      webhookUrl: URL,
      fetchImpl,
      counter: async () => {
        throw new Error("database down");
      },
      today: () => "2026-11-22",
    });
    await alarm.classifierFailed("timeout");
    await alarm.classifierFailed("timeout");
    expect(posts).toHaveLength(1);
    expect(String(posts[0].body.text)).toContain("first safety classifier failure today");
  });

  it("test_117_without_the_setting_it_only_logs_and_never_throws", async () => {
    const log = vi.fn();
    const counter = vi.fn(sharedCounter());
    const alarm = createSafetyAlarm({ webhookUrl: undefined, counter, log });
    await expect(alarm.classifierFailed("timeout")).resolves.toBeUndefined();
    expect(counter).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ event: "safety_alarm_not_configured" });
  });

  it("test_117_a_failing_webhook_is_logged_and_never_throws", async () => {
    const log = vi.fn();
    const alarm = createSafetyAlarm({
      webhookUrl: URL,
      fetchImpl: (async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
      counter: sharedCounter(),
      log,
    });
    await expect(alarm.classifierFailed("timeout")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith({ event: "safety_alarm_failed" });
  });

  it("test_117_the_webhook_carries_no_user_text_only_known_words", async () => {
    const { posts, fetchImpl } = webhook();
    const alarm = createSafetyAlarm({
      webhookUrl: URL,
      fetchImpl,
      counter: sharedCounter(),
      today: () => "2026-11-22",
    });
    await alarm.classifierFailed("timeout");
    // The payload has exactly these keys; the reason is one of the four identifiers.
    expect(Object.keys(posts[0].body).sort()).toEqual(["content", "text"]);
    expect(alarm.classifierFailed.length).toBe(1);
  });
});
