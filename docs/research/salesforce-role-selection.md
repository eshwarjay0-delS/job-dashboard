# Salesforce baseline selection — 20 October 2026

Method: source and artifact analysis, not proprietary REA extraction.

Owner requests: tailor the supplied Salesforce resume to the Salesforce Developer CPQ / Revenue Cloud job; choose the correct baseline and preserve identity. Current title-first selection shipped in `9b8b5e2`.

## Finding and change

`src/lib/role-match.ts` had no Salesforce domain. `titleFit('Salesforce Developer', 'Senior Salesforce Developer')` returned zero, leaving every resume in the fallback pool. Add Salesforce and SFDC as equivalent domain names. Existing role nouns still distinguish administrators from developers. No change to account isolation, rewriting, keyword scores, certifications, or fallback when no matching title exists.

Regression: `scripts/tests/role-match.test.mjs` first failed with 0 instead of 5. It covers exact titles, SFDC alias, CPQ / Revenue Cloud specialization, administrator separation, unrelated developers, and fallback preservation.

Validation: 51 focused role/library/WhatsApp/quality/journal tests passed; 71 broader resume/keyword/REA tests passed (overlapping suites, not a unique combined count). TypeScript, scoped ESLint, and production build passed. Build emitted nine tracing warnings in existing unrelated routes. Vercel deployment succeeded. No live WhatsApp message or email sent. This does not establish 98% content alignment or resolve the exact October 17 failed-run trace.

Published commit: `f520950b63f1f70c4c2fda9eac18c4eaf2c08f33`. The connected GitHub integration published the exact locally tested tree `a32be0018e1d1d27a43437d6c24df027b39ce4f6` after shell push lacked credentials. Vercel confirmed success for [deployment 9aai5V1qRUyfRdVGmaEfR1FFVWUd](https://vercel.com/qu4ntum-s-projects/job-dashboard/9aai5V1qRUyfRdVGmaEfR1FFVWUd). Fourteen additional identity/library/duplicate-request checks passed. Public health returned HTTP 200; neither proves authenticated generation quality.
