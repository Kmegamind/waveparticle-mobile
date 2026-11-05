# Phone features for the installed web app

## Scope and evidence

This spike checked the browser platform documentation and the repository's
current constraints. No physical iPhone or Android device, and no HTTPS preview
install, was available in this environment, so the device-install checks below
are explicitly not claimed as completed.

Sources:

- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [WebKit: WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)

## Findings

| Capability | Finding | Release 1 consequence |
|---|---|---|
| Background timers | Browsers throttle background timers and may suspend page execution. Visibility changes are observable, but they do not make a timer reliable. | Use timestamp-derived clock state. Do not promise background counting from a page timer. |
| Vibration | `navigator.vibrate()` is optional and does nothing where unsupported. The available evidence does not establish a release-wide iPhone guarantee. | Keep the 00:00 haptic opt-in and capability-gated. Do not promise it on every phone. |
| Lock-screen notifications | Persistent notifications require a service worker and notification permission. On mobile, use service-worker notifications rather than the page `Notification()` constructor. | A notification is technically possible only after the notification/service-worker work and permission flow exist. It is not a default release behavior. |
| iPhone web push | iOS/iPadOS 16.4 supports Web Push for web apps added to the Home Screen, including Lock Screen and Notification Center delivery. | The later notification story can target installed Home Screen web apps, subject to permission and device-version checks. |
| Android | The browser APIs are capability- and permission-dependent; no single Android behavior is guaranteed across browsers and device settings. | Test representative Android browsers before promising delivery or haptics. |

## Device test status

Not run here:

- Installing the test page to a physical iPhone Home Screen.
- Installing the test page to a physical Android Home Screen.
- Measuring vibration on either device.
- Measuring a time-up notification after the page is backgrounded or the screen
  is locked.
- Measuring background timer behavior after the operating system suspends the
  page.

These are environment limitations, not successful test results.

## Implications for the PRD

- FR-FOCUS-3 and FR-FOCUS-12 remain timestamp-based; background timers are not
  a supported clock source.
- FR-FOCUS-17 remains capability-gated, opt-in for haptics, and silent when the
  API is unavailable.
- FR-FOCUS-18 remains a later, opt-in notification feature. It requires a
  service worker, permission, an installed/eligible web app, and a tested
  delivery path; it must not be presented as universal.
- F4 remains the release 1 enforcement boundary: no background notification
  nudge is built as part of the focus flow.
