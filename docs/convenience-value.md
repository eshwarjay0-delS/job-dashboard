# The Convenience-Value Standard

Owner directive, 20 Oct 2026: the app is several segregated products under one roof.
Each product must carry its own value — a moment where the user feels the high of
convenience. Not the platform as a whole: **every feature, on its own.**

## The rule

A feature is not done until all three hold:

1. **Named moment.** Its convenience moment is written in one plain sentence below —
   what the user does (almost nothing) and what the product does (the work).
2. **One tap away.** The moment is reachable in ≤1 tap from where the user already
   lives (WhatsApp, the inbox, the Apply tab) — never behind setup, never behind
   a settings page.
3. **Verified end-to-end.** The moment was exercised for real, not mocked —
   the same bar as every other claim in this repo (approval ≠ delivery ≠ verification).

## The map

### Gmail / Inbox — "You never read your inbox. It reads itself."
The user does nothing; the product reads, sorts and drafts.
- Inbox self-sorts: RTRs, interview requests, rate confirmations, rejections —
  11-category classifier across up to 4 Gmail accounts.
- Follow-ups draft themselves (his template, weekly interview cadence, escalation
  ladder, marketing firms hard-excluded) and wait for a tap.
- Smart Reply: 3 chips per email, draft auto-filled from the per-account profile.
- **State:** shipped. **Gap:** follow-up drafts surface in chat cards; the in-app
  review flow is the remaining polish.

### Resume tailor — "Paste a job post anywhere. Get back a resume that matches it."
- Send a JD on web or WhatsApp → tailored .docx back, 95–100% keyword coverage,
  gaps named honestly, never invented credentials.
- Every JD keyword in + Gemini relational terms counted; user-given keywords are
  treated as confirmed skills.
- **State:** shipped (web + WhatsApp, always sends the file). **Gap:** the
  live-resume-failure-1728 run still needs its exact JD + source resume to fully
  reproduce; runs take 2–4 minutes.

### Apply — "One tap opens the exact job, already filled in."
- Tap Apply → the exact posting opens in-app; autofill walks with the user;
  the double-submit warning fires before a second chain can file.
- 9 job sources aggregated through us; match % with cert overlap; freshness;
  automation-path badges; Saved → Submitted pipeline with receipts;
  57-firm prime-vendor portal directory.
- **State:** shipped. **Gap:** our own crawler index is the real product —
  blocked on the owner's SQL migration run + headless-renderer pick; the
  auto-apply worker needs a direct-internet host for production.

### Kompas — "Talk, and you're interview-ready."
- Speak → answers grounded in the user's real project dossier, mentor tone,
  [beat]/[breath] pauses played as real silence; sessions never time out —
  they end only when the user stops them.
- OpenRouter paid models only; transcription on Groq Whisper.
- **State:** shipped on web. **Gap:** desktop wrapper auth gap (Electron does not
  share browser login); focus mode designed, not yet built.

### The Chief — "Brief it like a person. It works while you're away."
- Plain-words brief → the Chief decomposes it into watches, works in the
  background, nudges only on change, and gates every sensitive action behind a
  WhatsApp approval card (Send / Edit / Skip).
- One identity across inbox, Apply and Kompas — inclusive, not WhatsApp-only.
- **State:** Phases 1–4 shipped (conversational agent, unified identity +
  briefing/prep tools, briefable watches, approval cards — 20 Oct 2026).
  **Gap:** the standalone morning "while you were out" report as its own
  scheduled delivery.

### Overview / Today — "One glance, the whole hunt."
- Open the app → one plain sentence saying why you're there, plus big glanceable
  numbers: what's new, what's due, what needs you.
- **State:** shipped (Today's briefing digest, Overview RTR tables, per-vendor
  mind maps, interview deep-links). **Gap:** none open.

### Files / Library — "Your resumes organize themselves."
- Every tailored resume files itself under its email and kind of job; the next
  job starts from the closest one — an AI agent picks it beside the code's pick,
  both logged.
- **State:** shipped. **Gap:** pick accuracy flagged by the owner; the pick log
  is the evidence to keep reading.

### Crawler (our own index) — "Jobs come to you, fresh, from the source."
- Vendor portals crawled daily into our own index — the product never depends
  on a third party for its core data (competitor, never client).
- **State:** code live (Collabera + Beacon Hill adapters); tables blocked on the
  owner's SQL run. **Gap:** JS-shell portals need the headless renderer —
  the owner's pick is pending; that same pick is the in-app-browser and
  auto-apply decision.

## How new features get added

Name the moment first, in the sentence above's shape. If a feature cannot state
its moment in one sentence, it is not ready to build. When the moment ships,
update this file and the Plan & Vision journal in the same change.
