# Gmail reply-pattern delegation — REA sweep, 24 Oct 2026

Procedure-level reverse engineering for the approved reply-pattern build
(gate, availability delegate, 3-bucket inbox). Each product is traced
through the same procedure: detect trigger, triage a first-time sender,
pick a template, insert personal details, send, log, fall back. What is
borrowed is a behaviour, rebuilt in MarketFit code; no vendor code, address
model, or send-without-review default is copied.

## Superhuman snippets

- Authoring: write the template in a new email, name it, give it a short
  shortcut, save from the Snippets tab. It syncs across devices.
- Trigger: none automatic. The user types the shortcut and the whole
  snippet (subject, body, sign-off) is inserted.
- Template pick: by title/author from the snippet list; a snippet can be a
  whole email or one paragraph inserted into a personalised email.
- Personal details: bracketed slots (first name, your name) filled from
  recipient/sender at insert time. Editing the inserted copy never edits
  the saved snippet.
- Send/log: the user reviews and sends normally; read statuses, reminders
  and send-later sit around the send, not inside the snippet.

Borrowed into MarketFit: a named pattern library (gate-c2c-c2h,
availability-interview, followup-weekly-interview), each a template with
slots filled at compose time from the per-account profile and the card.
Insert-then-edit: editing a draft never rewrites the pattern. No slot may
pull DOB, SSN, passport or DL data.
Not borrowed: read-status tracking, or any send-on-shortcut-without-review
behaviour. Tier 1 review stays.

Sources: https://blog.superhuman.com/snippets/ ,
https://zapier.com/blog/superhuman-email

## Hey screener

- First-time sender triage: an unknown sender does not reach the inbox.
  The first message lands in The Screener, a holding queue; one question
  per sender: Yes (in) or No (never again).
- Routing after approval: approved senders route by choice — Imbox
  (important now), Feed (sometimes), Paper Trail (rarely). The choice
  sticks for that sender.
- Pre-approval: a Speakeasy code in the subject lets a known-but-new
  sender skip the queue. Decisions can be reversed.
- Not copied: a Hey address, holding mail away from Gmail, or blocking a
  sender at the Gmail level.

Borrowed into MarketFit: a first-time sender pen. A new external recruiter
gets a gate card and a sender-class record, not a normal reply chip.
Once the class is settled, later mail from that sender/domain follows the
normal pattern. Routing is by sender class, not by folder: new external
goes to Needs you (gate), known vendor to normal patterns, marketing firm
to filed-never-replied, newsletters and job-board blasts to a low-priority
bundle away from Needs you.

Sources: https://www.hey.com/how-it-works/ , https://www.hey.com/shield/

## Spike / Shortwave grouping

- Spike: threads grouped by sender, not by subject line. Signatures and
  repeated quoted history are stripped in the chat view; tapping a message
  expands it to traditional email format. The recipient still receives a
  normal email; the chat look is only on Spike's side.
- Shortwave: similar emails bundled under one subject line, so a bundle
  can be checked off, pinned or snoozed at once. A sender can be dragged
  onto another sender's mail to group them and rename the group. Email
  becomes a task: pin, snooze to a time, or check off when done.

Borrowed into MarketFit: req-first grouping (req/client/role plus sender
chain, not subject line and not thread alone). Two threads for the same
req from the same chain are one card; two chains on one req are two cards
with a double-submit warning. The card shows only the latest ask, the
sender and the decision; signatures, quoted history and JD boilerplate
hide behind "show full thread", never deleted. Newsletters, job-board
alerts and marketing bench blasts bundle out of Needs you; recruiter mail
is never bundled away. Task state per card: Needs you / Waiting / Done,
plus a next chase date for Waiting cards.
Not copied: a chat-only composer hiding the email format, or any
auto-archive of recruiter mail. Every MarketFit send is a real Gmail send
on the correct thread, from the correct account.

Sources: https://www.spikenow.com/features/conversational-email/ ,
https://www.digitaltrends.com/phones/shortwave-email-app-chatgpt-open-ai-changed-my-life/ ,
https://oncomp.com/2022/04/shortwave-solves-the-gmail-problem/

## Gmail Smart Reply and nudges

- Smart Reply: Gmail analyses the message (and, for contextual replies,
  the whole conversation, its tone and intent) and offers up to three short
  replies at the bottom of the message. Tap one to insert it; edit before
  sending. Contextual replies are longer, personalised drafts matching tone
  and past writing, with sources shown.
- Nudges: Gmail resurfaces a message it judges important and unanswered
  (a direct question not answered, or a sent mail with no reply) back to
  the top, suggesting a reply or a follow-up. It is selective and
  time-based; it does not draft the reply. Settings toggles are "Suggest
  emails to reply to" and "Suggest emails to follow up on".

Borrowed into MarketFit, with the flaw fixed: the 3-chip Smart Reply stays
the default for ordinary mail. The pattern card is the contextual version:
longer, grounded in the card's trigger plus sender class, pre-filled, not
a one-liner. Time-only nudging is replaced by decision nudging: a card
appears only when there is a decision to make (gate, availability, RTR
ack, rate confirm, doc-hold decision, double-submit pick-one).
Resurfacing alone, with no proposed reply, is not a nudge in MarketFit.
Evidence on the card: the exact ask quoted, the pattern name, and the
last date that shape was sent to that sender class — not a bare count.
Not copied: generic one-liners for recruiter mail, or a tap that sends
with no edit step in Tier 1.

Sources: https://support.google.com/mail/answer/17493601?hl=en&ref_topic=3395756 ,
https://support.google.com/mail/answer/15464729 ,
https://blog.tuttosemplice.com/en/gmail-nudges-the-feature-revolutionizing-your-inbox/

## What this change implements from the sweep

- src/lib/reply-patterns.ts: sender classes, pitch and availability
  detection, gate and availability templates with guardrail validators,
  same-req matching, 3-bucket logic, card headers, verb labels, and
  Tier 2 eligibility with all five checks.
- src/app/api/gmail/reply-patterns/route.ts: authenticated pattern
  library, req-first cards from the kept Gmail copy, classify, opt-in /
  opt-out, skip, handled, and send — with every guardrail re-checked
  server-side before any Gmail send.
- src/app/dashboard/mail/patterns/page.tsx: the 3-bucket Patterns page,
  painting from a local snapshot instantly on later visits, polling every
  120 seconds and merging new cards in, never rescanning per visit.
- Limits: procedure traced from vendor help and docs pages as recorded
  here and in the Oct 24 spec; no fresh live capture and no vendor
  account was used in this change. Owner acceptance on a real inbox
  (authenticated Patterns page, one real gate send, one real delegate
  send) is still the remaining verification step.
