# ParakeetAI: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of www.parakeet-ai.com were fetched (home,
/compare, /mock-interview, /question-bank, /resume-maker, /auth/desktop) with 50 first-party scripts. Nothing
downloaded was run. The Reverse Engineering plugin's `extract_endpoints.py` mapped the network surface. Captures stay
in the session scratchpad; no Parakeet code, text or images are copied into MFit. Everything below is what their own
public pages showed on 23 Oct, unless marked *inferred*.

## How it is built (observed)

- Next.js site (`/_next/static/immutable/chunks/…`). **No public source maps.**
- Sign-in: NextAuth-style session (`/api/auth/session`); separate flows for the desktop app (`/auth/desktop`),
  mobile (`/auth/mobile`, `/auth/mobile/complete`), email verify/confirm, and `/oauth/authorize`.
- API: tRPC (`/api/trpc`) and `/api/position-playground`.
- Analytics and ads: Mixpanel (`api-js.mixpanel.com`, `api-eu.mixpanel.com`), Google Tag Manager, Meta pixel.
- Sister products linked in the footer: Kismo, Tarko AI (and a reference to Megasheet).
- Surfaces: Windows and macOS desktop app, desktop Chrome for the web app, a mobile web app ("native app on its way").

## What the user sees (observed)

- **Hero:** "Real-Time AI Interview Assistant … interviews, sales calls, client meetings". Social proof: "Trusted by
  1.5M+ people", "4.86 from 340K+ reviews", "#1 AI Interview Assistant on SimilarWeb", "No. 1 Viral App in United States".
- **Before, during, after the call:** auto answer when a question is detected; **auto-detect meetings** (Google Meet,
  Microsoft Teams) and offer to start; upload briefs, notes and playbooks to use live; after the call, **AI notes**
  (summary, the questions asked, next steps), the transcript, and "Ask AI" on the call.
- **Session list:** mode, duration, credits used, date, whether the transcript is saved.
- **Real or mock session** from the same screen; the first mock interview is free.
- **Prepare tools:** Question Bank (questions by company, ranked by frequency), Mock Interviews, Resume Maker, Headshots.
- **Platforms shown as "Verified":** Zoom, Teams, Meet, Lark, Amazon Chime, CoderPad, HackerRank, with a video per test.
- **Coding:** listens for coding questions and reads code shared on screen.
- **Settings shown in FAQ:** 50+ languages, one at a time; model chosen per session (Gemini, GPT, Claude, fast default);
  instructions field up to 20,000 characters; phone calls through Google Voice.
- **Responsible-use page:** "built for conversations where AI assistance is permitted"; employers can ask to be
  **blocklisted** (compliance address published).

## Pricing (their own page, 23 Oct)

| Option | Price |
| --- | --- |
| Free | a 10-minute session, no card; first mock free |
| Unlimited monthly ("Most popular") | $149.90 / month |
| Unlimited yearly ("Best value") | $599.90 / year ($49.99 / month) |
| Weekly | $78.00 / week |
| Credit packs | 3 for $59.00 ($19.67 each); 8 for $118.00 (6 + 2 free); 15 for $177.00 (9 + 6 free, $11.80 each) |
| Single credit | $38.00 |
| What a credit buys | 0.5 = a 30-minute call or mock; 0.25 = one resume PDF; 0.5 = one headshot; 1 = one company's question bank |
| Prepare tools alone | $22.90 / month each (Resume Maker, Headshots, Question Bank); 3 months saves 50%; "Custom" bundle $68.70 / month |

Payment marks shown: Visa, Amex, Apple Pay, Google Pay, **UPI, PhonePe**. A refund policy is linked.

## Ideas worth taking for Kompas and MFit

Observed on their pages; whether they work for us is *inferred* until tested.

1. **A free first session with no card** (10 minutes), plus a free first mock interview.
2. **Two ways to pay side by side:** unlimited plans for heavy users, credit packs with bonus credits for someone
   with one interview. Plus a weekly plan for a short job hunt.
3. **One plain table of what a credit buys.** It removes guessing.
4. **Prepare tools sold one by one**, or bundled.
5. **UPI and PhonePe at checkout.** This fits Kompas's Telugu, Hindi and Tamil users directly.
6. **Auto-detect a meeting starting and offer to begin.** No setup in the middle of a call.
7. **After-call notes:** summary, the questions asked, next steps, and "ask about this call".
8. **A session history** showing mode, length, cost and whether the transcript was kept.
9. **Real or mock from one screen.**
10. **Uploaded briefs and playbooks** used live, and a large instructions box.
11. **A "works with" grid** (Zoom, Teams, Meet, CoderPad, HackerRank), each proven with a short video.
12. **A responsible-use page with an employer blocklist.** It is honest and lowers risk. Recommended.
13. **Model choice per session**, with a fast default.

Kompas already differs: Telugu, Hindi and Tamil as first-class languages, consent-first memory, and three answer
levels.

**Not recommended to copy:** the "completely undetectable" and "invisible on screen share / to tab switching /
in Activity Monitor" claims, and use "during online exams". They market evading the rules of an interview or exam.
That is a legal and trust risk for MFit, and it conflicts with consent-first Kompas.

## Not done

- No account was created, nothing was bought, and the desktop installer was not downloaded or opened.
- No signed-in pages were seen, and no live call was run.
- Their review and user counts are their own claims, not checked.
