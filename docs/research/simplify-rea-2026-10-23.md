# Simplify: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** The home page and 18 first-party scripts were saved, the
Reverse Engineering plugin mapped the network surface, and the visible text of 9 public pages and the Chrome Web Store
listing was saved. Nothing was run, nothing is copied into MFit. Observed on 23 Oct unless marked *inferred*.

The 17 Oct entry `simplify-autofill` studied the open-source Autofill-Jobs project (MIT) as a stand-in for how
Simplify-style autofill works. This entry is the live product.

**Blocked:**
- **Extension package:** the Web Store sends the download from `clients2.googleusercontent.com`, which is refused.
  The package id is `pbanhockgagggenencehbnadejlgchfc`, version 3.1.10.0, read from the download file name.
- **Simplify+ price:** `/pricing` is 404 and no public page shows the price (*inferred:* it is shown after sign-up).

## How it is built (observed)

- Next.js marketing site under `/_landing/`; **no public source maps.**
- API host `api.simplify.jobs` (paths seen: `/v2/job-posting/activity`, `/api/ip-location`); assets on
  `assets.simplify.jobs`. Also `help.`, `partners.` and `status.simplify.jobs`, and a consent manager (`c15t`).
- Sign-in: `/auth/login`, `/auth/register`, `/auth/register-mobile`. iOS app on the App Store.
- Analytics: Google Tag Manager.

## What the user sees (observed)

- **Promise:** "free for job seekers": matches, autofill and the tracker. They earn from Simplify+ and from employers.
- **Copilot extension:** autofill on Greenhouse, Workday, Lever and other systems, plus LinkedIn Easy Apply and
  Indeed. Each application sent through it is saved to the tracker automatically. It scores the resume against the
  job and helps write answers like "why are you a good fit". They claim 200M+ applications.
- **Autopilot (paid):** tailors the resume, writes a cover letter, fills and submits applications. "50 jobs with 5
  minutes of your time"; a queue ("25 jobs in your queue"); now on web and mobile.
- **Resume builder:** free forever, four templates, a free ATS readiness score, missing-keyword check against a job;
  deeper tailoring is Simplify+ (AI chat, settings for keywords, metrics and title emphasis).
- **Other:** AI mock interviewer, curated job lists (new grad, internships, remote), networking, an "AI Talent Agent"
  for employers, a paid human resume service ($129.00).
- **Trust:** a plain privacy promise (shared with employers only when you apply, never sold, export or delete any
  time). On the Web Store: 4.8 from 3.9K ratings, 600,000 users, "Featured"; declared data types include personal
  information, location and website content.

## Pricing (their pages, 23 Oct)

- Free: matches, Copilot autofill, tracker, resume builder, ATS score.
- Simplify+: subscription for AI tailoring and Autopilot; price not shown publicly.
- Resume service: $129.00.

## Ideas worth taking for MFit

1. **Free core, paid automation** (observed): autofill and tracking free, auto-submit paid.
2. **Every application sent through the extension lands in the tracker by itself** (observed). MFit's extension
   can do the same with its Apply pipeline.
3. **An application queue you can see** ("25 jobs waiting") with each one's state (observed).
4. **Resume score against the job, shown inside the application form** (observed).
5. **One-click tailored answers** to "why are you a good fit" from the job post (observed).
6. **A short, plain privacy promise on the home page** (observed).
7. **Curated job lists by audience** (observed). *Inferred:* for MFit, lists like "C2C-friendly", "H1B transfer" and
   "GC-only" roles fit the staffing candidates.
8. **A human resume service as a paid add-on** next to the AI (observed).

## Not done

- Extension package, so no manifest, permissions or message flow (host refused).
- No account: no Simplify+ price, no signed-in pages, no Autopilot run.
- Their usage numbers are their own claims.
