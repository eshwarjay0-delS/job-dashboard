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
- Interviews in the inbox (28 Oct 2026): an Interviews pile in `/dashboard/mail`, matched on account plus thread id; interview threads link to their board card and back; while a follow-up is switched on, the exact message stays visible on the card with Edit, Send now, and weekday ticks for the automatic send (Monday and Thursday ticked to start). Send now verifies against the board's kept copy, with the live scan only as fallback, and the button times out at 60 seconds with a check-Sent warning instead of spinning forever.
- 11-category classifier, follow-up engine, 5 watchdogs, daily 8am cron, crawler.
- Smart Reply (3 chips, per-account reply profiles, approve-before-send).
- Agent chat (`/dashboard/agent`) answering from mail.

## Form factor (current assumption)

Desktop-only for now. The mail experience is designed around a wide desktop canvas — described below as a folding layout (Samsung-trifold style). It collapses gracefully to fewer panels on narrow screens, but the desktop arrangement is the reference design.

## Pillar 5 — The folding layout (4 regions)

Think of the screen as folds that open as the user goes deeper:

- **Region 1 — Inbox list.** Looks like a normal phone inbox: scrollable thread list. At the top, an account toggle bar: **All inboxes | Inbox 1 | Inbox 2 | Inbox 3 | Inbox 4** — one toggle per connected Gmail account. Tapping a thread opens Region 2.
- **Region 2 — Thread view.** Scrollable: the email overview plus the whole thread and everything about it — attachments, labels, classification, follow-up state.
- **Region 3 — Context panel.** By default: the sender's contact card (Pillar 4). When the user hits **Reply**, the reply composer appears *on top* in this region, with smart reply suggestions beneath it — Google-style suggestions generated from the thread's own data (what was asked, what's known, what the user usually says).
- **Region 4 — Contact panel (reply mode).** Once reply is open, the contact details shift from Region 3 to Region 4, so the composer and the contact card are side by side.

The reply composer is full Gmail parity: To, CC, BCC, subject, body, attachments — everything the normal Gmail app does.

### Contact card spec (applies to every thread)

- Full name, email address, mobile number.
- **History of interactions**: how many times they've emailed, and the last message's subject line + date/time with a clock icon.
- Skeleton rule still holds: missing fields render empty, never invented.

### Per-thread "…" menu

Every thread gets a three-dots menu: **Mark as important**, **Send to automation**, plus the standard actions. 

**Definition (standing): important = tracked.** Marking a thread important means everything from that sender is actively tracked from then on. That is what "important" means in this app — always.

## Pillar 6 — Important section on Home

On the Home page, right *before* the Overview section, an **Important** section lists every email the user marked as important — the tracked set, at a glance.

## Pillar 7 — Automation: the agent side of the inbox

- **Send to automation.** The user selects messages and sends them to automation. Those messages keep feeding the agent: the agent learns *these are the replies, this is the data the user always wants sent* — and starts auto-replying on the user's behalf. The app tells the user this capability exists; it's presented, not hidden.
- **Conversational automation bots.** Chatbots live on the automation side. The user talks to them like they talk to an assistant: *"track emails like this"*, *"after I submit an RTR, send a follow-up twice a week"*, *"if they reply, tell me"* — and the agent just does it.
- **Inbox digest.** A dedicated section that always shows what's happening in Gmail: new important mail, follow-ups sent, replies received, what's waiting. The overview of the inbox, live.

## Poke lessons (researched 2026-10-17, public sources)

Poke (The Interaction Company) is the reference for proactive mail: multi-account OAuth connect, a background watcher polling every ~10–15 min, importance triage deciding notify-vs-quiet, proactive nudges the moment important mail lands, a morning briefing, plain-English "recipes", draft-on-behalf, and a learning brain.

Rebuildable capabilities for Mfit Gmail:
1. **Background watcher** — poll connected accounts on a short cadence; persist seen thread IDs; never reprocess.
2. **Importance triage** — score new threads (human vs automated, known contact/VIP, urgency signals like deadline/interview/offer). Poke's documented failure mode is triage precision → ship conservative thresholds + per-sender always/never-notify controls from day one.
3. **Proactive nudges** — one short message per thread when important mail lands: who, what, why it matters. Quiet hours respected. Every nudge carries its reason.
4. **Morning briefing** — daily digest: calendar, overnight important mail, day's key updates. Skimmable, actionable.
5. **Recipes** — "every Monday, summarize unread mail from X" in plain English; prebuilt library + user-defined.
6. **Draft-on-behalf** — Gmail drafts in the user's voice; nothing sends without approval.
7. **Brain** — every dismissed/acted-on nudge retunes triage. Fewer false nudges over time.

## What's new from this vision

1. Compose parity audit — subject/CC/BCC/attachments/sender picker, all working.
2. Unified inbox redesign — multi-account without the Gmail mess.
3. Contact card skeleton — designed once, applied everywhere, empty-by-default.
4. Folding 4-region desktop layout with account toggle bar.
5. Important = tracked: definition, per-thread marking, Home section.
6. Send-to-automation + pattern-learned auto-replies + conversational automation bots + inbox digest.

## Non-goals

- Rebuilding Gmail's entire settings surface. Parity covers daily workflows, not every toggle.
- Hiding which account a thread belongs to, ever.
- Inventing contact details. Empty beats wrong.

## Owner clarification — 17 October 2026

The product is a familiar personal email workspace with intelligence added to it. It must not force every person or email into a recruiter-specific identity. Every email uses the same contact skeleton, including when values are unknown.

### Folding interaction contract

| State | First pane | Second pane | Third pane | Fourth pane |
|---|---|---|---|---|
| Browse | Scrollable inbox list | Closed | Closed | Closed |
| Read | Inbox list | Overview and full conversation | Contact details and interaction history | Closed |
| Reply | Inbox list | Conversation remains visible | Composer, then suggested replies | Contact details and history |

The account strip includes All inboxes and every connected account, including empty inboxes. Selecting a message must not silently change the All-inboxes filter. Account and thread together identify a conversation. The sending account is visible and verified server-side; no fallback to another inbox is allowed.

Contact skeleton: full name, email, mobile number, receiving inbox, number of messages received, and chronological subject/date/time history with a clock symbol. Unknown values remain blank. Do not derive a person's name from their email local part or pretend a domain is their company name. History counts describe their actual bounded scan, not an exhaustive lifetime record.

Composer requirements: To, CC, BCC, subject, attachments, editable message and visible From account. Suggested replies fill the composer for review. They do not send merely because they were suggested. A closing composer must not silently discard a person's work; saved-draft persistence remains a required follow-up to this checkpoint.

### Important and automation have different meanings

**Important** means track this sender in this receiving account, including future incoming threads. The Home Important section appears ahead of the other dashboard content; Overview also includes it. Removing the rule stops tracking without deleting mail.

**Send to automation** captures a conversation, the user's instructions and their own reply example. Reuse those words as a suggestion scoped to the original account/conversation. The intended agent will turn instructions such as “after my RTR, follow up twice weekly until they reply” into an executable rule with trigger, schedule, recipient, sending account, template, approval mode, expiry and stop-on-reply condition. Show the interpreted rule before activation. Re-check live thread state before every send, deduplicate attempts, and never retry an uncertain send blindly. A reply, rejection, opt-out, expiry or paused account stops the sequence.

An inbox digest should report incoming messages, replies awaiting review, upcoming follow-ups and completed/failed actions with thread links. The agent needs an audit log, not just a chat acknowledgment.

### Implementation checkpoint

Implemented in the current change: folding reader/composer/contact panels; account-aware selection and deep links; CC/BCC and bounded attachments; verified sender/thread on send; blank unknown contact fields; persisted important-sender rules and Home/Overview listing; persisted automation instructions and reply-example reuse.

Still required: fully general Gmail inbox/folder coverage (existing data scan is job-oriented), Gmail draft autosave, full attachment parity, durable recurring send worker, conversational rule interpretation and digest of executed automation. Saved instructions are not advertised as an active automatic sender. Current follow-up suggestions remain manual review/send.


## Inbox update feed checkpoint — 17 October 2026

The Gmail page now includes an Inbox updates panel with saved account selection, enable/pause controls, refresh, and a recent message list with receiving account and thread links. Refresh runs every 30 seconds while the page is visible. The initial sync captures up to 25 existing inbox messages per selected account and labels them as existing history. Subsequent scans use Gmail history cursors; an expired cursor recovers with a fresh snapshot and suppresses historical phone alerts.

WhatsApp alerts are optional and off by default. The user chooses a code-verified linked number and may restrict alerts to Important senders in each receiving account. The notification includes account, sender and subject, not the message body. Atomic reservations prevent repeated sends after an uncertain provider response. A provider acceptance receipt is not proof of phone delivery. No external messages were sent during tests.

Deployment prerequisites for unattended operation: configure an approved Meta template through `WHATSAPP_GMAIL_UPDATE_TEMPLATE` (three body parameters: account, sender, subject), existing WhatsApp credentials, and `CRON_SECRET`. An external scheduler must invoke `/api/gmail/updates/tick` with the bearer secret. Set `GMAIL_UPDATES_SCHEDULER_ENABLED=true` only after scheduling is actually configured. The current worker processes up to four users per invocation and is not an unbounded real-time push service. No recurring schedule is enabled by this code change; the UI states when background refresh is unavailable.

Remaining acceptance: connected-account browser verification, approved template configuration, scheduler setup/capacity validation, delivery receipt visibility and actual mobile delivery. General Gmail folders, draft autosave and executable follow-up automation remain separate unfinished work.

### Mobile delivery evidence — 22 October 2026

Each inbox update can now show its saved WhatsApp delivery state: accepted by the provider, cancelled after settings changed, still uncertain, or held for review. Provider message identifiers remain server-side. “Accepted” is deliberately described as accepted for delivery, never as delivered to the phone; actual handset delivery still requires provider webhook evidence and owner-device acceptance. This makes uncertain sends visible without weakening the no-blind-retry rule.


### Missing-message sync recovery — 20 October 2026

Deployment confirmed through follow-up commit `da202203` (Vercel success, 20 October); this supersedes the initial failed-release status for `ff23ef6`. Public health is HTTP 200, not evidence of authenticated Gmail or mobile acceptance. Runtime-log access and connected-account/device validation remain outstanding.

If a listed message returns 404 during metadata retrieval, skip that absent message and finish storing the remaining messages before advancing the cursor. Do not treat authentication failures, rate limits, transport failures or server errors as deletions: those keep the old cursor for retry. This applies to initial snapshots and incremental history; it does not enable phone notifications or change consent. Evidence: `docs/research/gmail-missing-message-sync.md`.

### Browser reply recovery

Reply recipients, subject, body and attachments are saved on the current browser, separated by authenticated user, receiving Gmail account and conversation. Save and close writes before closing; storage failure shows an actionable message instead of claiming success. Write my own preserves the current reply. Only a confirmed successful send clears its saved copy. Clearing browser data removes these drafts. This is browser recovery, not Gmail Drafts synchronization; cross-device saving remains unfinished.

### In-app inbox alerts: haptics + chain connection — 21 October 2026

Owner directive (chat, 21 October): the verified-alert behavior he gets on his phone — urgent mail noticed, checked against reality, and connected to its submission chain — belongs inside the app itself, not only in the chat watcher.

What shipped: `InboxAlertWatcher`, mounted across the dashboard, polls `/api/gmail/alerts` every 2 minutes and on focus. The route reuses the classified-thread cache, the confirmed-invite evidence standard (`inviteEvidence` — request-only asks never alert), and `buildApplicationChains`. The pure shaping logic lives in `src/lib/inbox-alerts.ts` with unit tests (`scripts/tests/inbox-alerts.test.mjs`).

Multi-account identity rule: a conversation is identified by **receiving account + Gmail thread ID**, never by thread ID alone. Alert deduplication and direct application-chain attachment use that compound identity. A possible same-client/same-role chain in another connected inbox stays a review suggestion and names that inbox; it is never silently merged. This prevents identical account-scoped thread identifiers from cross-wiring a recruiter reply or suppressing an alert.

When an urgent item lands (confirmed interview invite, RTR request, rate confirmation, document request, offer), the user feels it and sees it: a vibration (`alertBuzz` for interviews, `arriveBuzz` otherwise, via `src/lib/haptics.ts`), a browser notification when permission is granted, and a card that names the chain connection — part of an existing chain with its current holder; a possible second chain on the same client + role arriving on a different thread (the double-submit pattern, flagged to confirm before replying); or genuinely new. A first-run watermark baselines at "now" so history never storms in; each item alerts once and dismissals persist.

Limits, stated plainly: this alerts while the app is open in a browser (the background phone watcher remains the out-of-app channel). Signed-in acceptance — an urgent email landing while the app is open producing the buzz, notification and connected card — is the owner's real-path check and is not claimed here.

### WhatsApp delivery-status evidence — 22 October 2026

Inbox alerts now retain Meta's signed sent, delivered, read and failed callbacks. The server maps a provider message ID through a one-way hash to the authenticated user's inbox-update event; provider IDs never enter the authenticated feed or UI. Callback evidence is append-only and the feed selects the furthest known state, so a late delivered callback cannot replace read. Provider acceptance remains distinct from device delivery.

This does not activate messaging. The approved WhatsApp template, scheduler and opted-in verified device still require configuration and controlled acceptance.

### Signed delivery evidence — 23 October 2026

Provider acceptance is not handset delivery. A public callback can only upgrade an alert to delivered or read when `WHATSAPP_APP_SECRET` is configured and the request passes Meta's `X-Hub-Signature-256` check. When the secret is absent, outbound alerts keep their accepted state but status payloads are ignored; the Inbox settings explain that signed delivery evidence is still waiting for setup. This preserves the existing bot path while preventing unsigned requests from becoming delivery proof.

### Damaged event recovery — 23 October 2026

The update feed validates saved records before display or mobile delivery. Malformed JSON, missing fields and mismatched event identifiers are skipped without deleting the stored record; valid updates remain in chronological order. Storage access failures still surface for retry. This recovery is deployed; authenticated acceptance remains pending. See `docs/research/gmail-feed-record-recovery.md`.
