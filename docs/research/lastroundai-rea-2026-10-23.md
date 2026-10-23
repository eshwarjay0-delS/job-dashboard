# LastRound AI: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of lastroundai.com were fetched (home, /pricing,
/pricing/credits, /features, /help/faq, /refund, /security, /undetectability, /products/ai-interview-copilot,
/products/mobile-copilot, /products/mock-interviews, /help/interview-setup, /help/desktop-setup, /changelog, /about)
with 70 first-party scripts from the home page. Nothing downloaded was run. The Reverse Engineering plugin's
`extract_endpoints.py` mapped the network surface. Captures stay in the session scratchpad; no LastRound code, text or
images are copied into MFit. Everything below is what their own public pages and publicly served scripts showed on
23 Oct, unless marked *inferred*.

Blocked: nothing. Every page returned 200. The web app at app.lastroundai.com was not opened, because it needs sign-in.

## How it is built (observed)

- **Vite + React** single-page app, pre-rendered for search (a `__PRERENDER__` flag and a prerender script are
  mentioned in their HTML comments). React Query, Radix UI (shadcn style), Recharts, React Helmet. **No source maps.**
- Backend: **Supabase** directly from the browser. The site reads a `release_downloads` table for the latest desktop
  builds (Mac Intel, Mac Apple Silicon, Windows) and calls the RPCs `log_site_download`, `record_download_touch` and
  `get_public_pricing`.
- Their security page lists the outside services: Supabase (database, sign-in, files), **AssemblyAI and Deepgram**
  (speech-to-text), **OpenAI, Anthropic, Google, OpenRouter** (answers and feedback), **PayPal and Razorpay**
  (payments), Hostinger (hosting), Resend (email).
- Analytics and ads: Google Tag Manager, Meta pixel, Microsoft Bing UET with a consent script.
- Pricing data sits in a script with a "verified" date (15 Oct 2026); a live RPC overrides it in the browser.
- The bundle holds a public Supabase anon key, which is normal for Supabase. It was not used.

## What the user sees (observed)

- **Main promise:** a live interview copilot with the answer starting in "~1s", inside a wider job-search platform.
- **Onboarding:** download (no sign-up to download), upload a résumé and job description, pick the interview language,
  start. A readiness pill says "Ready" or "Not ready" and names what is missing.
- **Interview Setup** has required parts (résumé, this interview) and optional ones (how the AI answers, about you,
  behavioural stories, coding, audio check). A "what the AI reads from your résumé" view shows the exact parsed text.
  The AI answers in the first person and, they say, will not claim an employer, title or date not on the résumé.
- **Answer controls:** for code, Regenerate, Another approach and Explain simpler; for anything, an Ask box (shorter,
  simpler, another language).
- **Rest of the platform:** voice mock interviews with scores, a 7,000-question prep hub, résumé builder with ATS
  score, company insights, job search with auto-apply ("you review and approve"), 238 animated concept explainers,
  and ten free tools (salary, offer comparison, India CTC to in-hand, ghost-job detector and others).
- **Platforms:** desktop app for Mac and Windows; a mobile web copilot in the phone browser; web app.
- **Languages:** 61 interview languages, including Hindi, Telugu, Tamil, Kannada, Marathi and Bengali (from their
  language list script). Site in English, Spanish, Portuguese, German, French and Japanese.
- **Privacy:** a "keep on this device only" choice writes the interview record to the user's computer and not to the
  account. Optional local recording, off by default. Account deletion from settings; "Clear local data" on desktop.
- **Trust signals:** a provider table, a security contact, a changelog, a dated credits explainer. Many testimonials
  use full names and big-company logos and some praise that "nobody suspected anything".

## Pricing (their own page, 23 Oct)

Prices depend on country. Outside India:

| Option | Price |
| --- | --- |
| "Unlimited Monthly" | $49 / month: interviews up to 60 min, 2 h live copilot a day, mock 5 h a month |
| "Unlimited 3 Months" ("Best value") | $117 every 3 months ($39 / month, "save $30"): interviews up to 2 h, 3 h a day, mock 1 h a day; price fixed on renewal |
| Free | 15 free credits a month, no card |

Fair use: daily time resets at midnight UTC; 2 devices; 1 live session at a time; shared logins are suspended without
refund.

In India the credit plans stay (1 credit = 1 minute of live voice time), paid in rupees through Razorpay or in dollars
through PayPal:

| Plan | Monthly | On a 3-month plan | Credits / month |
| --- | --- | --- | --- |
| Free | $0 | | 15 |
| "Starter Pack" | $29 (₹2,749) | $19 / month ($57, ₹5,397 per 3 months) | 150 |
| "Professional Pack" | $49 (₹4,655) | $39 / month ($117, ₹11,097) | 360 |
| "Ultimate Pack" | $99 (₹9,405) | $79 / month ($237, ₹22,497) | 750 |
| Bonus "Quick Boost" | $14 for 70 credits, never expire | | |
| Bonus "Power Pack" | $27 for 130 credits, never expire | | |

Rupee amounts come from their pricing script, not a page seen from India. Credit billing rounds up per minute; a mock
session is capped at the chosen length plus 3 minutes; a desktop session under 30 seconds is free.

Refund: only within **7 days**, and only if **no credits** from that purchase were used. Email only. Billing errors
are refunded.

## Ideas worth taking for Kompas and MFit

Observed on their pages; whether they work for us is *inferred* until tested.

1. **Show the user exactly what the AI read from their résumé**, and never let the answer claim a job or date that is
   not in it. This fits Kompas's provenance rule. (observed)
2. **A readiness check that names what is missing** before a session starts. (observed)
3. **"Keep on this device only"** for session records, with local review and one-click clearing. Fits consent-first
   Kompas. (observed)
4. **Rupee prices through Razorpay**, priced by country, beside dollar plans. (observed)
5. **One-click answer reshaping:** shorter, simpler, another approach, another language. Close to Kompas's answer
   levels. (observed)
6. **A credits page with a month planner** and exact rounding rules, including "under 30 seconds is free". (observed)
7. **Choose the session length up front and cap the bill** at that length. (observed)
8. **A table of every outside provider** and what each one sees. (observed)
9. **Fair-use limits stated in numbers** (minutes a day, devices, one live session). (observed)
10. **Bonus credits that never expire** and an order of spending them. (observed)
11. **A wider job-search platform around the copilot** (résumé, company insights, auto-apply with approval). Overlaps
    with MFit's dashboard. (observed; fit inferred)

Kompas already differs: Telugu, Hindi and Tamil as first-class languages rather than items in a list of 61,
consent-first memory, and three answer levels.

**Not recommended to copy:** they market "Stealth Mode", "invisible on screen share", an overlay excluded from screen
capture by the operating system, use in "online assessments" and HireVue, and a mobile copilot that is "completely
discrete" and avoids "raising any suspicion". These are built to hide AI help from interviewers and test proctors.
That is a legal and trust risk for MFit, and it conflicts with consent-first Kompas.

## Not done

- No account was created, nothing was bought, and the desktop app was not downloaded or opened.
- The signed-in web app was not seen, and no live call was run.
- India prices were read from their script data and credits page, not from a page served in India.
- Their testimonials, user counts and latency figures are their own claims, not checked.
