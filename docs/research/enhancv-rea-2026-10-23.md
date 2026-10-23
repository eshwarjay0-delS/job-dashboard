# Enhancv: live REA, 23 October 2026

Method: **REA tool attempt + public reference review.** Public pages of enhancv.com were fetched (home, /pricing,
/ai-resume-builder, /resources/resume-checker, /features/tailor-resume-to-job-description,
/features/job-application-tracker, /features/ai-job-application-tracker-chrome-extension, /features/resume-feedback,
/features/ai-interview-help, /reviews, /llm-info, /ats-hub) with 23 first-party scripts. Nothing downloaded was run.
The Reverse Engineering plugin's `extract_endpoints.py` mapped the network surface. Captures stay in the session
scratchpad; no Enhancv code, text or images are copied into MFit. Everything below is what their own public pages
showed on 23 Oct, unless marked *inferred*.

**Blocked:** the help centre (`help.enhancv.com`) was refused by this environment's network ("Tunnel connection
failed: 403"). The app itself (`app.enhancv.com`) was not opened, because it needs an account.

## How it is built (observed)

- Next.js, built with Turbopack, served under a `/_web/` base path; pages router with server-side props.
  **No public source maps.**
- Images on `cdn.enhancv.com`. Page content comes from a headless CMS (Strapi-style records with locale and
  publish dates; *inferred* from the page data).
- API host `api.enhancv.com`: `/api/paddleBilling/prices` (prices load from **Paddle Billing**) and
  `/api/uploadFile/resume` (resume upload from the public tailoring page). Site routes `/api/blog/posts`,
  `/api/preview`, `/api/revalidate`.
- Analytics and ads: Amplitude (events tagged on almost every link), Google gtag, Microsoft Clarity, Meta pixel,
  TikTok pixel, Reddit pixel, LinkedIn Insight, Bing UET. reCAPTCHA on forms.
- AI: their page says a mix of OpenAI, Claude, Gemini and DeepSeek models, "hosted in the EU", with their own router
  picking a model per task. Interview Help names OpenAI. There is also an Enhancv app inside ChatGPT.
- Site in 14 languages. A `/llm-info` page is written for AI crawlers.

## What the user sees (observed)

- **Main promise:** a resume builder for experienced professionals and executives that passes ATS parsing and still
  reads well to a person. Social proof: "15M+ resumes", 4.5 rating from about 5,364 Reviews.io reviews, press logos,
  and a paid head-to-head study against Zety, Teal, Resume.io and others (their own study).
- **Onboarding:** start from scratch, upload an old resume (PDF or DOCX), or paste a LinkedIn URL. The public tailor
  page lets you drop a resume and a job ad before signing up.
- **One-click tailoring:** pick a resume, paste the job ad, then choose 3 to 5 qualifications that fit best. It
  rewrites headline, summary, key achievements, bullets and skills. **Every change is highlighted and not applied
  until you accept it**, one by one or all at once. A master resume holds everything you have ever added.
- **Missing numbers:** Improve Text **puts a placeholder where a bullet needs a number it cannot know**, instead of
  inventing one.
- **Checks:** a job match score with found and missing keywords; 27 checks in the Resume Checker, 16 in Resume
  Feedback; flags bullets with no number, missing summary, contact gaps, and wording that could invite bias.
- **Tracker (free, no cap):** board with Bookmarked, Applied, Interviewing, Offer; the actual resume file sent is
  attached to each card with its match score; contacts, notes, tasks with due dates; follow-up reminder 5 days after
  applying and a thank-you reminder the day after an interview; one-click archive for rejections that keeps history;
  import from Sheets or Excel; weekly progress summary. Free Sheets and Excel templates for people who will not sign up.
- **Chrome extension:** saves a job from LinkedIn, Indeed, Glassdoor, Greenhouse, Workday and others with title,
  company, location, salary and description. Says it only looks for job-related pages.
- **Interview Help:** questions and editable answers from the resume and job ad, 3 to 5 STAR stories, a short
  "about me", and a company brief. Free: 3 reports of up to 10 questions.
- **Other:** AI job board with plain-language search (Pro), translation into 30+ languages, cover letters in a
  matching design, share link for comments from friends.
- **Export:** PDF and plain TXT. Their FAQ says no Word download, to keep layout fixed.
- **Trust lines:** "never share your data with 3rd parties or use it for AI model training"; delete your account any
  time; refund if the fault is theirs; "cancel anything in two clicks".

## Pricing (their own page, 23 Oct)

The visible price boxes are filled in by script; in the fetched HTML they read "€ NaN". The figures below come from
the same page's own data and its title ("Starting from $16.50").

| Plan | Price |
| --- | --- |
| Free | 7 days; all templates, basic sections, Enhancv branding, up to 12 section items; no card |
| Pro Monthly | $39 / month |
| Pro Quarterly | $69 every 3 months |
| Pro Semiannual | $99 every 6 months ($16.50 / month) |

Pro: 300 resumes and cover letters, ATS check, real-time suggestions, no branding, unlimited section items. The job
tracker stays free on every plan. A /reviews table says the free plan lasts 7 days after registration; after that,
downloads need a paid plan.

## Ideas worth taking for MFit

1. **Placeholder, not a made-up number** (observed). When a bullet needs a metric nobody gave, leave a visible
   placeholder for the person to fill. *Note for the owner:* the resume rule in `CLAUDE.md` asks for "conservative
   plausible estimates" instead. For a staffing firm, an invented figure on a candidate's resume is a credibility and
   legal risk. This is a conflict to decide, not something this note resolves.
2. **Suggest, highlight, accept** (observed). Tailoring shows every change and applies nothing until accepted, one
   by one or in bulk.
3. **Ask which 3 to 5 qualifications to lead with** before tailoring (observed). The person steers the rewrite.
4. **Attach the exact resume sent to each application card, with its match score** (observed). Answers "which
   version did they get?".
5. **Follow-up timers by default** (observed): 5 days after applying, a thank-you the day after an interview.
6. **Archive, do not delete, rejections** (observed). The board stays calm and the history stays.
7. **Keep the tracker free and uncapped** (observed). Charge for heavier AI, not for logging jobs.
8. **Import an existing Sheets or Excel tracker** (observed). Lowers the switching cost for recruiters.
9. **A "no training on your data" line beside the upload box** (observed).
10. **Interview prep from the same resume and job ad** (observed): STAR stories, short pitch, company brief.
11. **A plain-text export next to the designed one** (observed). MFit's .docx goal is stricter; a TXT copy is a
    cheap extra for ATS forms (*inferred*).

**Not recommended to copy:** the long list of ad pixels (Meta, TikTok, Reddit, LinkedIn, Bing, Clarity) on pages that
take a resume upload. It sits badly beside a privacy promise (*inferred*).

## Not done

- No account was created, nothing was bought, the extension was not installed, and no resume was uploaded.
- The help centre was blocked; signed-in app pages were not seen.
- Review counts, the "15M+ resumes" figure and their competitor study are their own claims, not checked.
