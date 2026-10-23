# Interview Sidekick: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of interviewsidekick.com were fetched (home,
/pricing, /faq, /help, /download, /setup-guide, /stealth-mode, /exam-assistant, /realtime-interview-assistant,
/interview-prep, /coding-interview-copilot, /reviews, /privacy-policy, /terms-of-service, /phone-interview) with 23
first-party scripts from the home page. Nothing downloaded was run. The Reverse Engineering plugin's
`extract_endpoints.py` mapped the network surface. Captures stay in the session scratchpad; no Sidekick code, text or
images are copied into MFit. Everything below is what their own public pages and publicly served scripts showed on
23 Oct, unless marked *inferred*.

Blocked: nothing. Every page returned 200.

## How it is built (observed)

- **Next.js** App Router site on **Vercel** (`/_next/static/chunks/…?dpl=…`, Vercel Analytics). **No public source
  maps.**
- Sign-in: **Supabase** on their own domain (`db.interviewsidekick.com`), Google sign-in or an email link; the desktop
  app uses a 6-digit code.
- API routes seen: `/api/create-checkout-session` (Stripe, with trial days, student discount and payment method
  fields), `/api/check-subscription`, `/api/process-new-user`, `/api/track-goal`, `/api/telemetry-config`,
  `/api/log-client-error`, `/api/datafast-visitor/persist`.
- Speech-to-text: **Deepgram** by default, with a feature flag for a local speech engine (*inferred* from a remote
  config object; we did not see it switched on).
- Voice: the **ElevenLabs conversational SDK over LiveKit** is bundled (*inferred* to drive the live voice mock
  interviewer).
- Coding practice: Monaco editor loaded from jsDelivr.
- Regional pricing: the browser looks up the visitor's country through ipapi.co, ipinfo.io or geolocation-db.com, and
  shows different prices for India and for Sri Lanka, Bangladesh, Pakistan, Vietnam, the Philippines, Indonesia,
  Nepal, Myanmar, Cambodia and Laos. Checkout mentions UPI AutoPay for India.
- Analytics and ads: DataFast (`datafa.st`), Google Tag Manager, Meta pixel, Vercel Analytics. A status page exists
  (`status.interviewsidekick.com`).
- The bundle holds a public Supabase anon key, which is normal for Supabase. It was not used.

## What the user sees (observed)

- **Main promise:** a live interview assistant for "before, during and after": practice, real-time answers, then a
  scored review.
- **Onboarding:** sign in, then a four-step session form: company, role and first name; the job description (up to
  8,000 characters); the résumé; then start. Interview language chosen in step one.
- **Three ways to run it:** desktop app (Mac and Windows, hears system audio), Chrome on any desktop (share the meeting
  tab with audio, nothing to install), and a phone browser (phone on speaker next to the laptop).
- **Key features:** live answers in "under two seconds"; Talk and Code modes; screenshot for coding questions; STAR,
  SOAR and CAR shaping for behavioural answers; case-interview frameworks; voice mock interviews; a 16,000+ question
  bank from 1,200+ companies; saved transcripts; a session report with clarity, structure and impact scores and "the
  top thing to fix"; progress over sessions.
- **Other uses marketed:** thesis defence, certification practice, performance reviews, visa interviews, MBA
  admissions.
- **Languages:** 31, including Hindi and Tamil. No Telugu.
- **Trust signals:** "737,000+" users, "4.8 from 2,500+ reviews", logos of big employers, anonymised score stories
  (for example 8 → 58), the founder's own email for support. Their privacy notice says data "may not be deleted upon
  request unless mandated by law". That is weak for a voice product.
- Support is email only.

## Pricing (their own page, 23 Oct)

| Option | Price |
| --- | --- |
| "Basic Sidekick" (free) | Unlimited test sessions, each capped at 2 minutes, all features; no card |
| "Ultimate Sidekick", monthly | $80 / month, shown as 50% off $160 with code SAVE50 |
| "Ultimate Sidekick", quarterly ("Job Hunt Pass", 90 days) | $159 every 90 days (about $53 / month, "save 34%"); struck-through $318 |
| Ultimate, weekly | $50 / week (help page) |
| India | ₹3,000 / month; ₹6,000 per 90 days (script data and help page) |
| Other regional markets | $30 / month; $20 / week; $60 per 90 days (help page) |

No annual or lifetime plan. The help page says the 50% discount is applied to every plan at checkout. Payment by card
through Stripe; UPI AutoPay mentioned for India.

Refund: **none**. "All sales are final", because the unlimited 2-minute test sessions exist. Cancel any time in the
app; access lasts to the end of the period.

## Ideas worth taking for Kompas and MFit

Observed on their pages; whether they work for us is *inferred* until tested.

1. **Country-based prices with rupee pricing and UPI AutoPay**, including a plain note that the bank's ₹15,000
   AutoPay ceiling is not the charge. Directly useful for Kompas users in India. (observed)
2. **A 90-day "job hunt pass"** sized to how long a search lasts, plus a weekly plan. (observed)
3. **Unlimited short free sessions** with every feature, so the user can test audio on a real setup. (observed)
4. **One per-interview session form** (company, role, job description, résumé, language) so answers fit that job.
   (observed)
5. **Three ways in: desktop app, browser tab audio, phone on speaker**, each with its own short guide. (observed)
6. **A post-session report with three scores and one "top thing to fix"**, then progress across sessions. (observed)
7. **Answer shapes on demand:** STAR, SOAR, CAR for behaviour; market sizing and revenue trees for cases. (observed)
8. **A help page that corrects outdated third-party reviews** of their own product, point by point. (observed)
9. **Remote telemetry and feature flags** fetched at start, so a speech engine can be switched without a release.
   (inferred from script)
10. **A voice-to-voice mock interviewer**. (observed as a feature; the vendor used is inferred)

Kompas already differs: Telugu as well as Hindi and Tamil (they have no Telugu), consent-first memory with deletion,
and three answer levels.

**Not recommended to copy:** they market a "Stealth Mode" that is "100% invisible on screen share", a process
disguised under another name in Activity Monitor and Task Manager, an overlay that "never steals focus" so browser
proctoring sees no tab switch, and an "Exam Assistant" for proctored exams. These are built to evade interview and exam
rules. That is a legal and trust risk for MFit, and it conflicts with consent-first Kompas.

## Not done

- No account was created, nothing was bought, and the desktop app was not downloaded or opened.
- No signed-in pages were seen, and no live call was run.
- Regional prices for countries other than ours come from their help page and script data, not a page seen from
  that country.
- Their user and review counts are their own claims, not checked.
- Only publicly served files were read. Nothing was decompiled.
