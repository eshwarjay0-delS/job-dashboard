# MFit Chrome extension: REA, 23 October 2026

Method: **REA tool attempt** on our own code (`extension/`, version 2.0.4): the Reverse Engineering plugin's
`extract_endpoints.py`, plus reading the source. No browser run.

## Rebuild map

- **Manifest V3.** Popup (`popup.html`/`popup.js`), module service worker (`background.js`), two content-script sets.
- **Permissions:** `activeTab`, `tabs`, `scripting`, `storage`, `notifications`; host access to the MFit app and about
  30 job sites and applicant systems (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Dice, Monster, CareerBuilder,
  Simplify, Greenhouse, Lever, Workday, iCIMS, SmartRecruiters, BambooHR, Ashby, Jobvite, Taleo, SuccessFactors,
  Eightfold, Rippling, Gusto, Workable).
- **On the MFit app:** `web-bridge.js` passes the signed-in session to the extension and moves applications the
  extension sent elsewhere into the dashboard's tracker.
- **On job sites (all frames):** `content.js` detects the applicant system and fills the form (per-system fillers for
  Greenhouse, Lever, Workday, Ashby, SmartRecruiters, BambooHR, Jobvite, iCIMS, LinkedIn Easy Apply, Taleo,
  SuccessFactors, Workable, Rippling, plus a general field map); `sidebar.js` shows match score, resumes and profile.
  Protected questions (sponsorship, citizenship, veteran, disability, race, gender, EEO) are never answered from the
  profile.
- **Messages:** `GET_PROFILE`, `GET_USER_RESUMES`, `GET_MATCH_SCORE`, `GET_RESUME`, `GET_JD`, `SAVE_JD`, `OPEN_POPUP`,
  `PING` to the worker; `SCRAPE_JD`, `DETECT_JOB`, `AUTOFILL`, `PING` to the page script; `MF_AUTH` from the app.
- **API calls:** `/api/profile`, `/api/user-resumes`, `/api/tailor`, `/api/tailor/file`, `/api/resumes/download`,
  `/api/cover-letter`, `/api/autofill-log`, `/api/health`, with the session as a Bearer token. `trusted-url.js` keeps
  that token on the configured dashboard and two download paths.

## Security

Three findings (one medium, two low) are recorded in the private parfAct repository
(`docs/security/2026-10-23-mfit-extension.md`), because this repository is public. Fixes are proposed there, not built.

## Ideas from the competitor captures that fit here

- Every application sent through the extension should land in the tracker by itself (Simplify does this); MFit
  already queues them and drains them on the next dashboard load.
- A match score before filling (Jobright), a "Needs you" state and a receipt per application (Tsenta).

## Not done

No browser run; no test against live forms in this pass (earlier autofill work tested real forms).
