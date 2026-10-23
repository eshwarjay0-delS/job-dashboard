# Superhuman: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of superhuman.com were fetched (home, /plans,
/plans/mail, /mail, /mail/calendar, /agents/email-assistant, /mail/features/email-mcp, /legal/trust,
/products/whats-new, /products/testimonials). Nothing downloaded was run. The Reverse Engineering plugin's
`extract_endpoints.py` mapped what the HTML exposes. Captures stay in the session scratchpad; no Superhuman code,
text or images are copied into MFit. Everything below is what their own public pages showed on 23 Oct, unless marked
*inferred*.

**Blocked:**
- **Code files:** every script is served from `superhumanstatic.com`, which this environment refuses ("CONNECT
  tunnel failed, response 403"). So no first-party JavaScript was read and source maps could not be checked.
- **Help centre:** `help.superhuman.com` was refused the same way.
- The app (Gmail or Outlook sign-in) was not opened, because it needs an account.

## How it is built (observed)

- Next.js pages router (`__NEXT_DATA__`, `_buildManifest`), app name "super-funnel", static files on
  `superhumanstatic.com`. **Source maps: unknown** (the CDN was blocked).
- Content from Contentful (`images.ctfassets.net`).
- Outside services named in the HTML: Google Tag Manager, Statsig (feature flags and experiments), Transcend consent
  manager (`airgap.js`), a Grammarly "web heartbeat" script, and flags for FullStory and Qualified chat.
- No API paths in the public HTML.
- The company now sells a suite under the Superhuman name: **Mail** (the email client), **Grammarly** (writing),
  **Docs** and **Databases**, and **Go** (an assistant with agents across apps). GPTZero is listed among "builders of
  Superhuman Platform apps".

## What the user sees (observed)

- **Main promise (Mail):** "save 4+ hours each week"; fly through email "twice as fast". Built on top of Gmail or
  Outlook, so nobody changes address. Their own claims: "20 million hours" saved a year, "40 million people and
  50,000 teams" for the suite.
- **Email Assistant:** works inside existing Gmail or Outlook. It labels mail as it arrives, archives low-priority
  mail (marketing, cold pitches), writes a draft in your voice for every email that needs a reply, and reminds you to
  follow up with a draft ready. Setup is three steps: connect inbox, set writing and scheduling preferences, start.
  **30-day trial, cancel any time.** A comparison table puts it against Gemini in Gmail and Copilot in Outlook.
- **Mail features:** Split Inbox (separate streams for team, VIPs, tool notifications), Remind Me if no reply in N
  days, Snippets (shared phrase and email templates), Send Later, Snooze, Undo Send, read statuses with device,
  team reply indicators, shared live email views with comments, keyboard shortcuts, offline support.
- **Calendar from the inbox:** mentioning a date shows that day's calendar; one tap turns an email into an event;
  share availability as times that update themselves, or a booking link; Google and Outlook calendars together.
- **Mail MCP:** connects all your Gmail and Outlook inboxes to Claude, ChatGPT and other AI tools. Example prompts
  include a morning briefing and batch follow-ups. **Every send needs your approval by default**; it acts only when
  asked.
- **Privacy lines:** AI providers are contractually barred from training on your data; custom instructions are
  logged to AI subprocessors but email data is not, and AI responses are not logged. SOC 2 Type 2 and GDPR named.
- **What's new page:** dated entries filterable by product, team and plan type (latest seen: 29 Sep 2026).
- **UI patterns:** monthly and annual toggle with the saving shown; a long plan comparison table with a floating
  header; "Most popular" and "Best value" badges.

## Pricing (their own pages, 23 Oct)

**Superhuman Mail** (/plans/mail; the page opens on annual billing, "Annual 17% off"):

| Plan | Price |
| --- | --- |
| Starter | $25 per member / month, billed annually (the page's data gives $30 on monthly billing) |
| Business ("Most popular") | $33 per member / month, billed annually; $40 billed monthly |
| Enterprise | "Let's talk!" |

Starter: email productivity, Superhuman AI, team collaboration, calendar, up to 25 seats. Business adds the strongest
AI, **Auto Drafts**, Ask AI, Mail MCP, custom AI Auto Labels, HubSpot and Salesforce, Recent Opens. Enterprise adds
SSO, SCIM, BYOK, audit logs and a success manager.

**Suite** (/plans): Free $0; Pro $12 per member / month billed annually ($15 monthly); Business ("Best value") $33
annually ($40 monthly), which includes Mail; Enterprise custom.

## Ideas worth taking for MFit

1. **Draft every reply, send nothing without approval** (observed). The default for MFit's Gmail assistant should be
   draft-only, with sending as an explicit step.
2. **Follow-up reminder when nobody replies in N days, with the draft already written** (observed). For job search,
   tie it to applications and recruiter threads (*inferred*).
3. **Split Inbox** (observed): separate streams. For MFit: recruiters, interview scheduling, application receipts,
   rejections, job alerts (*inferred*).
4. **Auto-archive noise** such as job-board marketing and alerts, based on the user's preferences (observed).
5. **Turn an email into a calendar event in one tap** (observed). Interview invites are the obvious case.
6. **Share availability inline as times that stay current** (observed). Useful for recruiter scheduling.
7. **Shared snippets** (observed): a staffing team's standard replies to recruiters, kept consistent.
8. **Stay inside Gmail; no migration** (observed). Three-step setup.
9. **A plain privacy statement about AI** (observed): no training, what is logged and what is not.
10. **A dated, filterable "what's new" page** (observed). It would also help with the "did anything change?" problem
    noted in `CLAUDE.md` (*inferred*).

**Not recommended to copy:** read statuses (email open tracking). Tracking whether a recruiter opened a candidate's
email is a privacy and deliverability risk, and it can be blocked by mail clients (*inferred*).

## Not done

- No account was created, nothing was bought, and no inbox was connected.
- First-party scripts and the help centre were blocked, so the network surface beyond the HTML is unknown.
- Their hours-saved and user counts are their own claims, not checked.
