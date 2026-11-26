"use client";

import { useEffect, useRef, useState } from "react";
import { changePrefs, DEFAULT_PREFS, readPrefs, type Prefs, deviceStorage } from "@/lib/me/prefs";
import { setKeepClockRunningAction } from "../actions";

/**
 * SIG (#74): four signals, each an On or Off paper tag as in prototype v4. The first three belong
 * to this device; "Keep the clock running when I leave" (#71) is saved on the account. The focus
 * page reads the time-up signal at 00:00 (#115); the others are not read yet.
 */

type Permission = NotificationPermission | "unsupported";

/** The lock-screen row after asking the browser: it turns on only when notifications are allowed. */
export function lockScreenAfterPermission(permission: Permission): {
  on: boolean;
  reason: string | null;
} {
  if (permission === "granted") return { on: true, reason: null };
  if (permission === "denied")
    return { on: false, reason: "Notifications are blocked for this site." };
  if (permission === "unsupported") {
    return { on: false, reason: "This browser cannot show notifications." };
  }
  return { on: false, reason: null };
}

function Row({
  id,
  title,
  text,
  on,
  onToggle,
  reason,
}: {
  id: string;
  title: string;
  text: string;
  on: boolean;
  onToggle: () => void;
  reason?: string | null;
}) {
  return (
    <div className="me-row sig-row">
      <div className="sig-text">
        <p className="sig-title" id={`${id}-title`}>
          {title}
        </p>
        <p className="sig-help" id={`${id}-help`}>
          {text}
        </p>
        {reason ? (
          <p className="sig-reason" role="status">
            {reason}
          </p>
        ) : null}
      </div>
      <button
        aria-checked={on}
        aria-describedby={`${id}-help`}
        aria-labelledby={`${id}-title`}
        className="me-toggle"
        onClick={onToggle}
        role="switch"
        type="button"
      >
        {on ? "On" : "Off"}
      </button>
    </div>
  );
}

export function SignalsScreen({ keepClockRunning }: { keepClockRunning: boolean }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [clock, setClock] = useState(keepClockRunning);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [clockReason, setClockReason] = useState<string | null>(null);

  // This visit's last change; a change starts from it or from storage, never from `prefs`, which
  // is still the defaults until the effect below has run, so Appearance and Plain text are kept (#490).
  const held = useRef<Prefs | null>(null);

  useEffect(() => {
    setPrefs(held.current ?? readPrefs(deviceStorage()));
  }, []);

  function setSignal(key: keyof Prefs["signals"], value: boolean) {
    const next = changePrefs(deviceStorage(), held.current, (current) => ({
      ...current,
      signals: { ...current.signals, [key]: value },
    }));
    held.current = next;
    setPrefs(next);
  }

  async function toggleLockScreen() {
    if (prefs.signals.lockScreen) {
      setLockReason(null);
      setSignal("lockScreen", false);
      return;
    }
    // Permission is asked only now, when the user turns it on (#74 AC3).
    const permission: Permission =
      typeof Notification === "undefined"
        ? "unsupported"
        : await Notification.requestPermission().catch(() => "denied" as const);
    const result = lockScreenAfterPermission(permission);
    setLockReason(result.reason);
    setSignal("lockScreen", result.on);
  }

  async function toggleClock() {
    const next = !clock;
    setClock(next);
    const outcome = await setKeepClockRunningAction({ on: next }).catch(() => ({
      status: "failed" as const,
    }));
    if (outcome.status !== "ok") {
      setClock(!next);
      setClockReason("Could not save this setting. Please try again.");
    } else {
      setClockReason(null);
    }
  }

  return (
    <>
      <p className="me-quiet">Nothing is sent unless you turn it on.</p>
      <div className="sig-rows">
        <Row
          id="sig-time-up"
          on={prefs.signals.timeUp}
          onToggle={() => setSignal("timeUp", !prefs.signals.timeUp)}
          text="One light vibration at 00:00, on phones that support it."
          title="Time-up signal"
        />
        <Row
          id="sig-new-card"
          on={prefs.signals.newCard}
          onToggle={() => setSignal("newCard", !prefs.signals.newCard)}
          text="A light vibration when a new card arrives."
          title="New-card signal"
        />
        <Row
          id="sig-lock"
          on={prefs.signals.lockScreen}
          onToggle={() => void toggleLockScreen()}
          reason={lockReason}
          text="Shows the Step name on the lock screen once you turn it on. Your phone will ask first."
          title="Lock-screen notification"
        />
        <Row
          id="sig-clock"
          on={clock}
          onToggle={() => void toggleClock()}
          reason={clockReason}
          text="The clock keeps counting while the app is out of view."
          title="Keep the clock running when I leave"
        />
      </div>
    </>
  );
}
