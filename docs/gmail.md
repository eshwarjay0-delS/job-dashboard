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
- Interviews in the inbox (28 Oct 2026): an Interviews pile in `/dashboard/mail`, matched on account plus thread id; interview threads link to their board card and back; while a follow-up is switched on, the exact message stays visible on the card with Edit, Send now, and weekday ticks for the automatic send (Monday and Thursday ticked to start). Send now verifies against the board's kept copy, with the live scan only as fallback, and the button times out at 60 seconds with a check-Sent warning instead of spinning forever. A History tab beside the message lists each MarketFit send, with the last-sent date shown on the card. The board never pauses: buttons work per card, so one card's send never disables another; ticks paint at once and save in the background showing Saved; the ring days sit at the top right of the panel, solid-filled with the frequency spelled out as once a week; a sent follow-up raises a little toast that slides in and clears on its own; and the sending panel folds shut on its header tap. A plain Send now re-tap within the hour of a recorded send is skipped as a double-tap; a reworded send still goes out.
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


## 11 November 2026 — Poke-inspired account and mobile acceptance

The owner-approved broad direction remains up to four connected Gmail accounts, per-account Gmail/Calendar targeting, account+thread identity, no silent cross-account merge, selected From preservation, and reconnect limited to the affected inbox. The last read-only production aggregate (10 Nov) showed 3 account IDs, 2,002 cached threads and 3 sync rows. This does not prove two-inbox partial/failure recovery or mobile acceptance.

PR #290 isolates the approved 4 October mobile navigation correction: the hamburger panel expands in normal document flow below the sticky header, pushes content down, and does not overlay, dim or inert the page. Its latest exact head 7bd60f97a1b486f66ec61a018f64a9dbe5dc00a9 passed full CI 42969455798, schema 42969455846 and Kompas baseline 42969455728. The shared voice-preview gate fails and the Vercel project is blocked, so the change is not merged or production-accepted; a real narrow-phone check remains.

Per-account sync-health cards in PRs #271/#286 remain draft/proposed because no separate owner approval for that UI was retrieved. Do not enable the unattended update worker without its external scheduler, CRON_SECRET, approved Meta template and explicit GMAIL_UPDATES_SCHEDULER_ENABLED=true. The scheduled Auto Reply Loop's latest run failed its configuration check and skipped its POST step; no email action occurred. No real Gmail API call, email send or WhatsApp send was made in this continuation.


## 11 November 2026 — selected sender regression coverage

PR #297 adds five test-only cases against the actual `gmail-send` route with mocked authentication, OAuth-token and network adapters. They verify selected From plus the matching OAuth account, same-inbox thread lookup before send, selected-inbox reconnect without fallback, unknown sender rejection, and disabled-account rejection. Exact-head full CI `42997343901` and Kompas baseline `42997343939` passed, including the new Gmail isolation step. No real Gmail API call or email send occurred, and no runtime behavior changed. The protected Vercel preview remains unavailable while the project/account is blocked, so PR #297 is open and unmerged. Real two-inbox healthy/partial-failure and narrow-phone acceptance remain pending; the proposed sync-health cards and unattended update worker retain their separate approval/configuration gates.

 
## 11 November 2026 — Gmail account freshness snapshot (12:04 UTC)

Read-only production state shows 3 connected-account sync rows and 3 distinct account IDs, with 2,002 cached threads. Latest sync is 10 Nov 14:44:44 UTC; latest cached-thread update is 14:46:49 UTC. No sync or thread update occurred in the last hour; all three sync rows are within 24 hours. The composite `(user_id, account_id, thread_id)` key has zero duplicate groups.

This confirms persisted per-account separation only. It does not demonstrate a healthy inbox plus a partially failing inbox, live reconnect behavior, mobile delivery or email sending. PR #297's five mocked sender/thread-boundary regressions pass full CI and baseline, but the protected preview remains blocked. Keep the unattended worker disabled until the external scheduler, `CRON_SECRET`, approved Meta template and explicit enablement are configured. No real Gmail API call or email was sent.


## 11 November 2026 — Supabase Auth egress restriction

A production `/api/gmail/notify-rules/export` request at 20:07 UTC failed with `AuthApiError` status 402 and `exceed_egress_quota`. Supabase project metadata reports `ACTIVE_HEALTHY`; the runtime error specifically identifies a restriction on the Auth service, so this is not evidence that the entire database is down. Gmail aggregates remain three account IDs, three sync rows and 2,002 cached threads, with latest sync 10 November 14:44:44 UTC and no sync in the last hour.

The exact unblock requirement is an owner billing decision: upgrade the Supabase plan or remove spend caps to restore the restricted service. No billing change, credential swap, alternate-auth workaround, manual sync or email send was attempted. Keep the unattended worker disabled until the external scheduler, `CRON_SECRET`, approved Meta template and explicit owner enablement are all present.


### Mobile navigation non-obstruction — 12 November 2026

Owner requirement retrieved from 4 October 2026: “Navigation must not block/cover the view; even if opened, it should not obstruct the page.” The selected implementation expands the hamburger panel below the sticky top bar in normal document flow and pushes content down; it does not float over, dim or make the page inert. Outside-pointer, Escape, route-close and focus-return behavior are implementation/accessibility details rather than separate owner-authored requirements.

PR #309 restacks the behavior onto current master and preserves the later `serverReportsAuthDisabled` sign-out guard. Exact-head full CI is pending, the Kompas baseline passes, and the protected preview gate is blocked by the missing private `KOMPAS_VERCEL_API_TOKEN`. No production deployment or real phone/mobile viewport acceptance is claimed.

 
## 12 November 2026 — production and mobile recheck (04:13 UTC)

The canonical production alias now resolves to READY deployment `dpl_amu7rE9qzAEG6N7iYjEpnu7BDAwj`, exact master `da1db145c5981254f95620ff6bb0222ab4228125`. PR #313 is merged and adds five mocked selected-sender and receiving-inbox isolation regressions to CI (full CI `43143457248`, baseline `43143457299`); it does not change runtime Gmail behavior or prove a real send.

Production Auth egress is currently restricted: the 24-hour runtime aggregate shows 32 `/api/gmail/notify-rules/export` failures across 27 users, latest `2026-11-12T04:07:07Z`, HTTP 402 `exceed_egress_quota`. The owner/project administrator must resolve the Supabase Auth restriction. No billing change, credential swap, alternate-auth workaround or email send was attempted.

The last read-only account snapshot remains three account sync rows and 2,002 account-keyed threads, latest sync 10 Nov 14:44:44Z. This is persisted account separation, not two-inbox healthy/partial-failure, reconnect or selected-From live acceptance.

PR #309 exact-head full CI `43145194068` and Kompas baseline `43145194212` passed for the approved normal-flow mobile navigation (hamburger expands below the sticky top bar and pushes content down; no overlay). Protected preview `43145190595` remains blocked because private `KOMPAS_VERCEL_API_TOKEN` is unavailable. No real phone/narrow viewport acceptance or production deployment is claimed. Keep sync-health cards proposed and the unattended update worker disabled until its external scheduler, CRON_SECRET, approved Meta template and explicit enablement are present.


## 12 November 2026 — mobile navigation restack

The approved Poke-inspired mobile behavior is restacked as PR #318 on PR #317. It preserves the normal-flow requirement: the hamburger opens below the sticky top bar and pushes content down; no overlay/scrim. It adds `dashboard-shell.test.mjs` to fail-fast prebuild without dropping the resume profile suites. Exact head `571b8594b3189f87f5d3fe50f2067a65330d09f6` is a draft stacked PR with no workflow run visible yet. Prior #309 full CI/baseline success does not validate this restack. Real phone acceptance and protected preview remain open; no email was sent and the unattended worker stays disabled.


## 12 November 2026 — continuation recheck (06:53 UTC) <!-- gmail-poke-recheck-0653z -->

- Canonical master `da1db145c5981254f95620ff6bb0222ab4228125` is READY on production deployment `dpl_amu7rE9qzAEG6N7iYjEpnu7BDAwj`; the Vercel deployment response lists `job-dashboard-fawn.vercel.app` and `aliasError: null`. This is deployment/alias metadata only; no public HTTP or authenticated UX smoke was run in this check.
- **WhatsApp/resume:** PR #303 exact-head full CI `43138216531`, WhatsApp recovery `43138216521`, and Kompas baseline `43138216526` all SUCCESS; protected preview `43138214326` fails because the private `KOMPAS_VERCEL_API_TOKEN` is absent and the Vercel project reports `live=false`. Dependent PR #316 head `4af7d8b` has WhatsApp recovery `43163655905` SUCCESS; full CI/baseline await parent acceptance. Resume evidence PR #317 exact-head full CI `43164222540`, WhatsApp recovery `43164222577`, and baseline `43164222576` all SUCCESS; protected preview remains blocked. The 17 Oct 17:28 Chicago case still lacks its generated DOCX, per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt. Fresh Library search did not find a uniquely correlated output; iZap has one business with zero linked WhatsApp numbers and a 17 Oct `resume` search returned zero messages.
- **Poke/Gmail:** PR #313 is merged in `da1db145` and adds five mocked selected-sender/per-inbox isolation tests only; no Gmail runtime behavior or real send changed. PR #318 (`571b8594`) is a draft mobile-navigation restack on #317, with no workflow run visible yet. The last recorded Supabase Auth export failure was HTTP 402 `exceed_egress_quota`: 32 failures across 27 users, latest 04:07:07 UTC. The owner/project administrator must resolve that Auth restriction. The unattended update worker remains disabled; sync-health cards remain unapproved.
- **Contract crawler:** Latest production crawl is still 10 Nov 11:00:24–11:01:11 UTC, 6,818 found/upserted across 20 portals, one Inspyr abort. No 11/12 Nov run exists because the owner-approved daily cron was removed; manual/on-demand only. Read-only SQL found 131 active Right To Hire/Right to Hire rows still `unknown` (120 seen in 14 days), while 589 Contract To Perm rows are classified `contract`. PR #315 exact-head full CI `43157849751` (47 steps), crawler regression `43157849909` (8/8) and baseline `43157849768` (92/92) pass; protected preview `43157849584` failed at exact-head resolution. No row rewrite or manual crawl.
- **Kompas:** PR #314 is test-only; full CI `43157259968` and baseline `43157260433` pass, but protected preview `43157259910` is blocked. The separate Kompas Continuous Voice Delivery automation is disabled. No voice/capture edits, real 50-pair model responses, human scorecards or native-device acceptance were performed.
- The common release wall is the missing private `KOMPAS_VERCEL_API_TOKEN` in GitHub Actions plus Vercel project `live=false`. The owner or authorized repository administrator must configure it privately and restore legitimate preview availability; no protection bypass is allowed. The Supabase Auth 402 needs a separate owner/project-admin billing or spend-cap decision. No real email/WhatsApp message, R2 write, manual crawl, production row mutation, billing change, secret read or authentication bypass occurred.

**Continue:** run the Plan Journal/REA schema and full CI on this current-master documentation restack; keep it DRAFT if the protected preview remains unavailable. Then resume the highest-priority code stack in order: #303 before #316, #317 before #318, and #315 only after its own protected preview. Keep the historical 17 Oct incident open until its exact artifact and provider correlation are recovered or explicitly marked irrecoverable.


## 12 November 2026 — active Supabase Auth restriction (07:13 UTC) <!-- gmail-auth-402-0713z -->

A fresh 24-hour production error aggregation shows 38 `/api/gmail/notify-rules/export` HTTP 402 `exceed_egress_quota` failures across 30 users, latest `07:07:19Z`, on current deployment `dpl_amu7rE9qzAEG6N7iYjEpnu7BDAwj`. The last 30-minute query shows one event. This is an active Supabase Auth service restriction, not evidence that the project as a whole is down. The owner/project administrator must upgrade the plan or remove the spend cap. No alternate auth path, credential swap, manual export or email send was attempted.

The account-sync snapshot remains 3 account sync rows and 2,002 account-keyed threads from the prior read; no new two-inbox, reconnect, selected-From or phone acceptance is established. Keep the unattended worker disabled.

### Mobile navigation correction — 12 November 2026

The owner's 4 October requirement is that opening the hamburger must not block or cover the view. PR #320 restacks the normal-flow implementation on current master: the menu expands below the sticky 64px top bar, pushes content down, and does not dim the page or make the main content inert. Outside pointer interaction, Escape, route selection and desktop-width changes close it; Escape restores focus to the hamburger. The desktop rail and account switching remain unchanged. Four source-contract regressions replace the obsolete drawer/scrim assertions and are wired into fail-fast prebuild. PR #320 is DRAFT; exact-head CI and the protected preview gate are pending. No production deploy or real phone-width acceptance is claimed.


### Prebuild contract follow-up — 12 November 2026

The first full CI for PR #320 failed one test in `scripts/tests/kompas-deploy-build.test.mjs`: the shared build-contract assertion required an exact prebuild string, so adding the mobile shell suite correctly changed the string but tripped the stale assertion. The failure was not a voice runtime regression. Corrective commit `a021c6c3cd3a3e964ec4375a66cbf9f7a5220baf` replaces byte-for-byte equality with ordered required-group checks, explicitly verifies the dashboard-shell suite remains in prebuild, and permits additive suites without dropping existing gates. The new exact-head CI result is still pending; the prior baseline passed. No production or phone acceptance is claimed.


### Current release and Auth gate — 12 November 2026, 09:22 UTC

PR #320's corrected head `a021c6c3cd3a3e964ec4375a66cbf9f7a5220baf` has Kompas baseline run `43190229393` SUCCESS. Full CI `43190228931` is still in progress at migration asset closure. Protected preview `43190224739` failed closed because the private `KOMPAS_VERCEL_API_TOKEN` is empty; it must be configured privately by an authorized repository administrator. The initial full CI failure was the stale exact-string prebuild assertion and is corrected in the latest commit.

The live `/api/gmail/notify-rules/export` route has 42 Supabase Auth `402 exceed_egress_quota` errors across 34 users in the last 24 hours, latest 09:07:04 UTC; one event appears in the last 30 minutes. The project owner/administrator must upgrade the Supabase plan or remove the spend cap that restricts Auth. No authentication bypass, credential swap, billing change, real email send, unattended worker or two-inbox acceptance was performed. Vercel project metadata reports `live=false`; READY/alias metadata is not public UX acceptance.


### Full CI result — 12 November 2026, 09:23 UTC

PR #320 exact head `a021c6c3cd3a3e964ec4375a66cbf9f7a5220baf` now passes full CI `43190228931` (47/47 steps) and Kompas baseline `43190229393`. The prebuild log explicitly shows `scripts/tests/dashboard-shell.test.mjs` and reports 4 tests, 4 pass, 0 fail. The protected preview `43190224739` failed at exact-head preview resolution because the private `KOMPAS_VERCEL_API_TOKEN` is empty. PR #320 remains DRAFT; no production deployment, public HTTP, two-inbox or real-phone acceptance is claimed.


### Account-keyed persistence recheck — 12 November 2026, 09:30 UTC

Read-only production SQL returned 3 rows in `mfit_gmail_sync` across 3 account IDs for 1 user, with latest sync at `2026-11-10 14:44:44.277 UTC`. `mfit_gmail_threads` contains 2,002 rows across the same 3 accounts for 1 user; latest thread update is `2026-11-10 14:46:49.790 UTC`. No message bodies were read. This confirms account-keyed persisted data only, not fresh two-inbox sync, selected-From delivery, isolated reconnect or phone behavior. The 24-hour Auth export aggregation remains 42 `402 exceed_egress_quota` errors across 34 users, latest 09:07:04 UTC; the Supabase owner/admin must resolve the spend-cap restriction before acceptance.


## Poke-inspired account and mobile status — 12 November 2026, 09:35 UTC

PR #320 head `a021c6c3cd3a3e964ec4375a66cbf9f7a5220baf` implements the approved mobile hamburger behavior: the panel opens below the sticky top bar in normal document flow, pushes content down, never overlays or dims the page, and closes on outside interaction, Escape, route selection or desktop widening. Exact full CI 43190228931 and Kompas baseline 43190229393 pass; protected preview 43190224739 fails closed because the private `KOMPAS_VERCEL_API_TOKEN` is empty. No real phone acceptance is claimed.

The account-keyed production snapshot remains 3 sync rows and 2,002 cached threads across 3 account IDs, with latest sync 10 Nov 14:44:44 UTC; this is not fresh two-inbox or reconnect acceptance. Supabase Auth export is restricted by HTTP 402 `exceed_egress_quota` (42 errors across 34 users in the latest recorded 24-hour aggregation, latest 09:07:04 UTC). The project owner/admin must resolve the Auth spend cap. The unattended Gmail/WhatsApp update worker remains disabled; no email was sent.


## 12 Nov 2026 — account-scoped digest routing and partial-inbox resilience

PR #323 (`fix/gmail-multi-account-digest-routing-20261112`) is the current implementation slice, exact head `66f6e04c20c3d88945e34eb6ab446d6e5ee590af`. It fixes four account-identity leaks in the Poke-style digest: opening a digest/radar/role card now carries the receiving account and selects that inbox; waiting-age matching uses account + provider thread ID; digest React keys use account + thread; and sender mute/unmute plus pending-save state use receiving account + sender, matching the server's account-scoped notify-rule key.

The PR also adds mocked, non-sending coverage for same thread IDs across different inboxes, per-account mute/unmute, account-aware click wiring, and a healthy inbox remaining visible when a second connected inbox has no token. The Gmail fetch implementation already catches account-level failures independently; the new regression makes that behavior explicit. Lint and TypeScript checks passed on this head, and the Kompas baseline gate passed. Full CI `43206768698` is still running in the migration-asset suite; the new Gmail test step has not yet executed. Protected preview `43206764474` failed closed because the private `KOMPAS_VERCEL_API_TOKEN` is unavailable. Keep the PR DRAFT and unmerged.

Production remains blocked for authenticated multi-account acceptance: Vercel runtime logs show Supabase Auth `402 exceed_egress_quota` on `/api/gmail/notify-rules/export`, 46 events across 37 users in the last 24 hours, latest `2026-11-12T11:07:00Z`. Read-only database snapshot remains 3 account sync rows across 3 accounts, 2,002 cached threads, latest sync `2026-11-10T14:44:44.277Z`; no fresh sync or real phone acceptance was demonstrated. No email, WhatsApp, or Google API request was sent in this continuation. Do not bypass Auth spend limits or claim live Gmail acceptance.
