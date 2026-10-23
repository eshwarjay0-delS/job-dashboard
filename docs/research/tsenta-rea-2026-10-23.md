# Tsenta: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** The home page and 13 first-party scripts were saved, the
Reverse Engineering plugin mapped the network surface, and the visible text of 8 public pages and the Chrome Web Store
listing was saved. Nothing was run, nothing is copied into MFit. Observed on 23 Oct unless marked *inferred*. The
18 Oct entry `tsenta-autoapply` (`docs/research/tsenta-recon.md`) mapped their MCP server and architecture; this entry
is the live product today.

**Blocked:** the extension package (`momaobilceffibifldnhndcehhdjgaob`) comes from `clients2.googleusercontent.com`,
which is refused here.

## How it is built (observed)

- Next.js site; **no public source maps.** App on `dashboard.tsenta.com`; API and MCP server on
  `api.autojobs.me` (`/api/v1/mcp`). MFit's own code already references `api.autojobs.me` (see the 23 Oct inventory).
- Seen in the scripts: PostHog analytics, Google Tag Manager, Supabase, Stripe, Datadog.
- Surfaces: web dashboard, iOS and Android apps, Chrome extension, **iMessage and WhatsApp**, and an **MCP server**
  for Claude Code, Claude Desktop and web, Cursor and Codex, using OAuth with Google sign-in.
- Backed by Y Combinator (S26, per their disclosure page).

## What the user sees (observed)

- **Promise:** "be the first to apply to every job that fits you". Watches 50,000+ career pages on 30+ ATSes
  (Workday, Greenhouse, Lever, Ashby and more) and applies with a tailored resume as soon as a role appears.
- **The pipeline in four stages:** find, prep, apply, track. A live log shows pages scanned and matches found.
- **Dashboard:** job matches with a percentage; a tracker with tabs All, In flight, **Needs you**, Failed, Skipped;
  each row shows resume and cover letter state ("Ready", "Tailoring résumé"), status and time; "Submit all".
- **Control:** a **diff view of every change before it is sent**, with approve or edit; or more automatic settings.
- **Receipts:** each application can produce a record of the fields sent, the answers, the resume and cover letter,
  and the confirmation.
- **Inbox (optional):** reads job mail, routes recruiter replies to the right application and moves its status.
- **Visa:** surfaces known sponsorship signals and uses the work-authorization answers in the account; says it does
  not guarantee sponsorship. The Pro plan is pitched at "the laid-off, the OPT-clocked".
- **Trust:** a public AI disclosure page; founders' email; Web Store 7,000 users.

## Pricing (their page, 23 Oct)

"Pay for the applications, not the tool. Every tier is the full product. Tiers differ only by volume."

| Plan | Price | Applications per 30 days |
| --- | --- | --- |
| Free | $0, no card | first 25 applications |
| Starter | $19 / month | 600 |
| Pro (most popular) | $39 / month | 1,500 |
| Power | $99 / month | 4,500 |

Monthly, quarterly and annual billing; cancel in one click; "pay only for jobs actually submitted".

## Ideas worth taking for MFit

1. **A "Needs you" tab** in the tracker for applications waiting on the person (observed).
2. **Show the resume changes as a diff before sending**, with approve and edit (observed). MFit's tailor already
   changes the resume per job; showing the diff makes it trustworthy.
3. **A receipt per application:** fields, answers, files, confirmation (observed). MFit has an apply-receipts table.
4. **Recruiter replies routed to the right application, status moved automatically** (observed). MFit's Gmail
   side can do this for Apply.
5. **Every plan is the full product; plans differ only by volume** (observed). Simple and fair.
6. **25 free applications, no card** (observed).
7. **WhatsApp as a way in** (observed). MFit already has a WhatsApp bot; Tsenta shows it as a front door, not a side
   feature.
8. **An MCP server** so a candidate's own AI can run the search (observed). It was mapped on 18 Oct and not built.
9. **Sponsorship signals with an honest no-guarantee line** (observed). *Inferred:* MFit can add C2C and GC signals
   for staffing candidates, which Tsenta does not show.

## Not done

- Extension package (host refused). No account, so no signed-in pages and no live application.
- Their numbers are their own claims.
