# Kompas overlay P0 — 25 November 2026

Source and artifact analysis of the live overlay on master `794e8cfd`. No model call. No secrets.

## Session start

`checkSessionReadiness` posted `{ preflight: true }` with `AbortSignal.timeout(50000)`. A foreground call, including the desktop auth-ready hook, set the Start button to disabled and "Checking…". The sentence "Session has not started. The answer service is not ready. Check again before starting." lived in `beforeSessionNotice` and was not wired to a control that re-probed. The probe is now `public/kompas/readiness-probe.js`: 1.8 seconds, then 250 ms and 700 ms. Timeout, 4xx, 5xx, status 0 from `kompas://app`, and a slow 200 all return `start: true`. A failed probe leaves the answer request on the existing fallback chain. Check again calls the probe with `recheck: true` and hides the banner. Start is not disabled by the probe.

## Window controls

The desktop shell is Electron in `legacy/perfact/desktop`. `frame` is false. There is no `tauri.conf.json`. `bringBack` restored a minimized window, including after a display-metrics event, so Minimize did not stick. The title-bar buttons now send `kompas:minimize` and `kompas:close`. A user minimize is left minimized. The buttons are outside `data-tauri-drag-region`, use `-webkit-app-region: no-drag`, and sit above the resize grips.

## Clarifier and weight

`render` painted an empty bridge shell and left the panel hidden, so the clarifying box did not show the live question. The panel is a sibling of the question and the answer, inside the overlay the screen grab hides. It writes the current question into `#clarifyLive` as the question text changes. The opacity slider sets `--panel-a` and forces `--answer-shadow` to 0. It does not set the answer weight. The B button cycles 700, 600, and 400, default 400, in `perfact.answerWeight` and in the desktop prefs.

## Honesty

A resume that is only the short Saint Louis profile (`jayeshwar44` or "Saint Louis University", and none of Fortinet, NIST, CSPM, Okta) still uses the Houston Fortinet source. A loaded resume that names those current terms stays the source. That is the Round 6 rule, plus the S5 fixture's short profile.

## Not verified

No Windows click-through. No live model call. Production was not checked in this note.
