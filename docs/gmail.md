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
