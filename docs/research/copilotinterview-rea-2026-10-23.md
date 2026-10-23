# CoPilot Interview: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of copilotinterview.com were fetched (home,
/pricing, /faq, /refund-policy, /security, /ghost-mode, /interviewer-mode, /enterprise, /ai-interview-assistant,
/ai-mock-interview, /changelog, /hi, /terms, /vs-interview-sidekick). The site serves no first-party script files;
its code is inline in the home page, which was captured. Nothing downloaded was run. The Reverse Engineering plugin's
`extract_endpoints.py` mapped the network surface. Captures stay in the session scratchpad; no CoPilot code, text or
images are copied into MFit. Everything below is what their own public pages showed on 23 Oct, unless marked
*inferred*.

Blocked: nothing. Every page returned 200.

## How it is built (observed)

- A static, hand-written HTML site on **Cloudflare Pages**, with a Pages Worker for redirects (their changelog says so).
  Plain inline JavaScript, GSAP and Lenis for animation. **No source maps.**
- Sign-in: **Supabase** auth in the browser (email and password, Google OAuth).
- API: a separate backend on Vercel (`copilot-interview-api.vercel.app`) with `/api/get-key` (returns a licence key
  after a Stripe checkout session), `/api/billing-portal` (sends the Supabase token, returns a portal link) and
  `/api/attrib` (a "how did you hear about us" answer after purchase).
- Payments: **Stripe Payment Links** (`buy.stripe.com`). A guest can buy without an account and gets a licence key on
  the thank-you screen and by email.
- Analytics and ads: Google Ads tag (gtag, conversion events for sign-up, download and pricing clicks), Microsoft
  Bing UET with a consent check for European time zones, Cloudflare Web Analytics.
- The desktop app is **Electron** (their Ghost Mode page says so). Downloads: Microsoft Store, a Windows zip, a
  macOS zip, and an Android APK outside Google Play. Current version shown: v1.3.16.
- Their security page names the AI chain: Groq Whisper for speech-to-text (Gemini as fallback), then the chosen model
  from Cerebras, Groq, Google, OpenAI, Anthropic or Inception, all through their proxy.
- The page holds a public Supabase anon key, which is normal for Supabase. It was not used.

## What the user sees (observed)

- **Main promise:** a structured answer about two seconds after the interviewer's question ends, for coding, system
  design and behavioural rounds on Zoom, Teams and Meet.
- **Onboarding:** download and run, no sign-up needed for the free plan. Captions of the question appear live; press
  Answer or let it auto-answer.
- **Four modes in one app:** Candidate (live help), Mock Interview (questions built from your résumé and the job
  description, read aloud, scored out of 10 with a model answer and a report card), Interviewer Mode (questions,
  live scoring, a hire / no-hire report), and Resume Builder (tailored résumé plus a referral message).
- **Dual AI mode:** two models answer the same question side by side. Model can be switched mid-session.
- **Coding:** full code in a chosen language, reads a shared screen or a screenshot, finds bugs, shows an example run.
- **Platforms:** Windows 10+, macOS 12+; Android companion in beta (phone on speaker); iPhone "coming soon". Works next
  to Zoom, Teams, Meet, CoderPad, HackerRank, CodeSignal, Chime and HireVue.
- **Languages:** "50+" on the home page, 58 on the Hindi page; Mock Interview in 10 languages. The app UI is English
  only (their Hindi page says so). The marketing site is also in Spanish, Portuguese, French, German, Hindi, Chinese.
- **Data story:** session files saved in the user's Documents folder; audio, transcripts and answers not kept on their
  servers. One help-widget answer says transcription is local, while the security page says audio goes through their
  proxy to Groq. **The two statements disagree.** Optional anonymous question stats are on by default outside the
  EEA, UK and Switzerland.
- **Trust signals:** named team, security page with data flow, a responsible-disclosure policy and security.txt,
  dated refund policy with version history, changelog, testimonials with abbreviated names. A comparison table
  against "big-name copilots" and human coaching.
- **Enterprise:** seats, central billing, SSO/SAML, custom role templates. Price on request.

## Pricing (their own page, 23 Oct)

| Option | Price |
| --- | --- |
| Free | $0 forever: 15 minutes a day, sessions up to 15 minutes, free models, all four modes, no card |
| "Standard" | $14.99 / month (shown as a sale; regular $19.99): 60-minute sessions, up to 100 minutes a day |
| "Pro" | $29.99 / month: 70-minute sessions, unlimited, ChatGPT + Gemini models, Dual AI |
| "Pro+" | $49.99 / month: as Pro, adds Claude and Gemini 3 Flash, priority support |
| Annual (home-page toggle) | Standard $99.99 / year; Pro $199.99 / year ($16.66 / month); Pro+ $249.99 / year ($20.83 / month) |
| Hour packs, never expire | "Trial" $5.99 for 1 hour; "Interview Ready" $19.99 for 5 hours; "Career Boost" $34.99 for 15 hours |
| Enterprise | Custom |

The /pricing page (dated 19 Jul 2026) lists only "Pro Annual" at $199.99 / year; the home-page toggle shows all three
annual prices.

Refund: 14-day money-back on the **first payment of a new subscription only**, once per customer, and only if under
30 minutes of live session time were used. Renewals are not covered. Policy v1.1, effective 11 Sep 2026.

## Ideas worth taking for Kompas and MFit

Observed on their pages; whether they work for us is *inferred* until tested.

1. **A real free tier with a daily allowance** (15 minutes a day, no card), not a one-off trial. (observed)
2. **Hour packs that never expire**, beside subscriptions, for someone with one interview coming. (observed)
3. **A refund rule tied to usage** (under 30 minutes used), with the usage visible in the account. Fair to both sides.
   (observed)
4. **A dated, versioned refund policy** that says which version governs which payment. (observed)
5. **A security page that walks the data flow step by step** and names each provider. Kompas should do the same,
   and keep every statement consistent; theirs contradict each other. (observed; the lesson is inferred)
6. **Session files stored on the user's own device** by default. Fits consent-first Kompas. (observed)
7. **Mock interview built from the résumé and the job description**, read aloud, scored with a model answer and the
   likely follow-up. (observed)
8. **Two answers side by side** from different models, so the user picks an angle. (observed)
9. **An Interviewer Mode** on the same engine: question generation, live scoring, a report. A second market for the
   same pipeline. (observed)
10. **Guest checkout with a licence key** shown at once and emailed. Fewer steps to pay. (observed)
11. **A phone companion that just listens on speaker**, and says plainly what a phone cannot do. (observed)
12. **Plain plan advice** ("count the minutes, not the months"). (observed)

Kompas already differs: Telugu, Hindi and Tamil as first-class languages (their app UI is English only),
consent-first memory, and three answer levels.

**Not recommended to copy:** the "Ghost Mode" private window, which they describe as keeping the assistant out of a
screen share, with taskbar hiding and the OS content-protection API. They add caveats and tell users to follow employer
rules, but the feature exists to hide AI help from the interviewer. That is a legal and trust risk for MFit, and it
conflicts with consent-first Kompas.

## Not done

- No account was created, nothing was bought, and no installer or APK was downloaded or opened.
- No signed-in pages were seen, and no live call was run.
- The model names, user outcomes and latency figures are their own claims, not checked.
