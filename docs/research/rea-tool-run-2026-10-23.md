# REA tool run, 23 October 2026: Kompas desktop shell and the MFit application

Owner request (23 Oct): "Continue with rest of REA perfectly to the depth with each context, as if we are
reconstructing those exact apps from zero. Get REA plugin, install it and use it."

This replaces nothing. The 17 Oct entry `rea-tool-inventory` (rea-agents@6.5.0, stopped by a missing `ps`) stays
as it was. This is the first REA run that executed.

## Method

- Tool: the "Reverse Engineering" plugin (Anthropic Directory, community publisher, skill `reverse-engineering`
  2.2.3), installed by the owner on 23 Oct. Scripts run: `check_tools.py`, `triage.py`, `extract_endpoints.py`.
- `rea-agents@6.7.0` (the npm CLI behind the 17 Oct attempt) was **not** installed: the session's safety check
  refused installing that third-party package. `ps` works on this machine, so the 17 Oct blocker itself is gone.
- Targets, both our own code:
  - Kompas desktop shell `main.js` as the owner uploaded it on 21 Oct (sha256
    `c4bb17e95f1454d2e8dee037490b07822d57a655323f7d10c5962674cbfa1555`, 590 lines), and the current
    `parfAct/desktop/main.js` (788 lines, last change 07e51a9).
  - MFit: `src/` (150 API routes, 73 pages), `public/` (the Kompas web client), `extension/`.
- Every finding below is tagged: *read in source*, *run* (the real function executed in a VM harness), or
  *inferred*.

## Kompas desktop shell, at rebuild depth

What you would have to build to reproduce it (*read in source*, parfAct/desktop/main.js unless noted):

| Part | How it works |
| --- | --- |
| Process | Electron, single-instance lock; a second launch hands its argv to the first (`second-instance`). Registers `kompas://` and `marketfit-kompas://` as OS protocol handlers. |
| Window | One frameless, transparent, always-on-top (`screen-saver` level, re-pinned every 250 ms when unfocused) panel. Minimise becomes a 184×38 collapsed mark. Snap/dock within 24 px of edges; bounds saved to `userData/desktop.json`. Content protection (`applyProtection`) hides it from screen capture when Private is on. |
| Page | Loads the live site (`/kompas/index.html` on the MarketFit origin); navigation off-site is cancelled and opened in the browser; `window.open` denied. `panel.css` injected on dom-ready. |
| Renderer isolation | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the picker window the same, with its own preload. |
| IPC | `kompas:collapse/close/place/place-pick/place-cancel/resize-start/move/end/live` (send) and `kompas:prefs/set-prefs/get-private/set-private/take-session` (invoke). Senders are not checked, but only same-origin pages can load in the window. |
| Hotkey | `Ctrl+Enter` registered globally only while a session is live; it dispatches a synthetic Ctrl+Enter keydown into the page (AI Answer). |
| Audio | Mic (audio only; camera denied by both permission handlers). Computer audio: `setDisplayMediaRequestHandler` answers getDisplayMedia itself with the first screen plus `audio: "loopback"` (the Windows output mix), so no picker appears and the page cannot pick another source. |
| Auth | Sign-in opens `/auth/desktop` in Chrome, which hands the session back to the app through its protocol handler. The shell adds an `Authorization: Bearer` header on `/api/*`, refreshes through `/api/auth/refresh-token`, and stores the refresh session with `safeStorage` (ecba606). Interview launches arrive through `marketfit-kompas://open`. |
| Recovery | Reload on renderer crash; re-pin on display change, resume and unlock; storage flushed before close. |

Network surface (*run*, `extract_endpoints.py` on the uploaded copy): one origin
(`job-dashboard-fawn.vercel.app`), paths `/login`, `/api/`, `/api/auth/refresh-token`; markers `access_token`,
`refresh_token`, `Authorization`, `Bearer`.

## Security finding (details kept private)

The run found one high-severity weakness in the desktop sign-in handoff. The details, the reproduction and the
proposed fix are in the private desktop repository (parfAct, `docs/security/2026-10-23-desktop-signin-handoff.md`).
They are not described here because this repository is public. The fix is proposed, not built.

## MFit application inventory (*run*, `extract_endpoints.py`)

- `src/`: 121 declared client calls, 126 API path templates, 150 route handlers, 73 pages.
- Outside services the code calls (domain counts from source, vendor-directory data excluded): Gmail API
  (`gmail.googleapis.com`, `www.googleapis.com`, `oauth2.googleapis.com`), OpenRouter, Groq, OpenAI, Gemini
  (`generativelanguage.googleapis.com`), Meta WhatsApp Cloud (`graph.facebook.com`), Twilio Verify, RapidAPI
  JSearch, Jobright, AutoJobs, RemoteOK, Remotive, Arbeitnow, USAJOBS, Clearbit logos, Vercel. The reference apps
  (Simplify, Tsenta, Jobscan, Poke, Parakeet, Viktor) appear only as links and notes.
- Crypto markers: AES-GCM in `src/lib/keyVault.ts`, HMAC in `src/lib/sttLedger.ts` and `src/lib/usageIngest.ts`.
  The "DES"/"RSA"/"AES" matches elsewhere are text, not crypto use: "JOB DESCRIPTION" in prompts
  (`api/cover-letter/route.ts:93`, `api/kompas/questions/route.ts:71`), "Archer RSA" as a skill
  (`api/jobs/route.ts:790`, `resume/ResumeBuilder.tsx:93`), an interview-prep answer (`interviews/page.tsx:37`).
  Read for the first lines listed by the tool, not every match.
- `extension/`: 8 API paths and 11 hostnames (the ATS sites it fills).

## Not done, and why

- **Rebuilding the outside reference apps** (Jobright, Simplify, Tsenta, Parakeet, Poke, Jobscan, Viktor, Sauna,
  Granola) from their live sites and shipped bundles: this environment's network policy refuses every one of
  those hosts (proxy `CONNECT 403`; also `chromewebstore.google.com` and `clients2.google.com`, so no extension
  package can be fetched). Only GitHub is reachable. Nothing about them was re-observed today, and the existing
  entries were not re-labelled.
- `rea-agents` CLI run: not installed (above).
- No Windows run.
- Ghidra/jadx/asar tools are not installed; the targets did not need them (plain JavaScript).
