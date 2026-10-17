# Gmail — Master Vision

*Owner's vision, captured 2026-10-17. The north star for MarketFit's mail experience. Build toward it in phases; never against it.*

## The one-liner

Everything Gmail does, plus the intelligence Gmail never built — a mail app that knows who people are, what they want, and what you should do next.

## Why Gmail is the target (and the anti-pattern)

Gmail had to stay lightweight for billions of users. That tradeoff is why the inbox is just raw mail: no smarts, no agent underneath, no understanding. "Dull-minded." We don't have that constraint — our users get the full capabilities *and* the intelligence.

## Pillar 1 — Full Gmail parity

The app must do everything regular Gmail does, no excuses:

- Search and filters (including Gmail-grade query syntax where feasible)
- Reply / reply-all / forward
- Compose with subject line, sender picker (per connected account), CC, BCC, attachments
- Labels, archive, trash, mark read/unread, snooze-equivalents

If a user can do it in Gmail, they can do it here. Parity is the floor, not the ceiling.

## Pillar 2 — The intelligence Gmail doesn't have

A real-time agent lives beneath the inbox:

- **Auto-classification** of every thread (RTR, rate confirmation, interview request, document request, submission, rejection, assessment — the classifier already exists; keep extending it).
- **Follow-up engine** that drafts and escalates on the user's own cadence (already exists; keep it).
- **Watchdogs** watching for double-submits, rate drift, vendor silence, stale interviews (already exist; keep them).
- **Smart triage**: the inbox explains itself — why this thread matters, what stage it's at, what the next action is. No raw piles.

## Pillar 3 — Multi-account, without the mess

The owner has 3–4 Gmail accounts connected. Gmail's "all inboxes" view is confusing — same senders, same subjects, no idea which account you're in. Replicating that mess is forbidden.

- **Unified but legible**: one inbox view across accounts, but every thread wears its account badge. You always know which "you" an email belongs to.
- **Smart grouping**: group by person / role / req where it helps (a recruiter's thread across two accounts is one story), but never merge silently — the account boundary stays visible.
- **Per-account everything**: reply profiles, signatures, and compose identities are per account. The wrong "from" address is a bug, not a papercut.
- **Simplify, don't duplicate**: if a view doesn't make multi-account life clearer than Gmail does, it doesn't ship.

## Pillar 4 — Contact intelligence on every email (the skeleton rule)

Whenever you open an email, a contact card for the sender appears alongside it — automatically:

- **What's in it**: name, company/vendor, their role, phone, email, location — plus *relationship context* from our own data: which reqs they submitted you for and when, whether they're a marketing firm (never a follow-up target), last touchpoint.
- **Sources**: auto-extracted from the email itself (signature blocks, headers) + enriched from the people pages and submission tracker.
- **The skeleton rule**: the card layout is fixed and renders *everywhere* the pattern applies (mail view, overview, tracker, anywhere a person appears). Fields with no data show **empty by default** — never hidden, never invented. The skeleton is the system.
- Empty is honest. A missing phone number is a blank line, not a guess.

## What exists today (keep and extend)

- `/dashboard/mail` — the mail experience home.
- 11-category classifier, follow-up engine, 5 watchdogs, daily 8am cron, crawler.
- Smart Reply (3 chips, per-account reply profiles, approve-before-send).
- Agent chat (`/dashboard/agent`) answering from mail.

## What's new from this vision

1. Compose parity audit — subject/CC/BCC/attachments/sender picker, all working.
2. Unified inbox redesign — multi-account without the Gmail mess.
3. Contact card skeleton — designed once, applied everywhere, empty-by-default.

## Non-goals

- Rebuilding Gmail's entire settings surface. Parity covers daily workflows, not every toggle.
- Hiding which account a thread belongs to, ever.
- Inventing contact details. Empty beats wrong.
