# Salesforce baseline selection — 20 October 2026

Method: source and artifact analysis, not proprietary REA extraction.

Owner requests: tailor the supplied Salesforce resume to the Salesforce Developer CPQ / Revenue Cloud job; choose the correct baseline and preserve identity. Current title-first selection shipped in `9b8b5e2`.

## Finding and change

`src/lib/role-match.ts` had no Salesforce domain. `titleFit('Salesforce Developer', 'Senior Salesforce Developer')` returned zero, leaving every resume in the fallback pool. Add Salesforce and SFDC as equivalent domain names. Existing role nouns still distinguish administrators from developers. No change to account isolation, rewriting, keyword scores, certifications, or fallback when no matching title exists.

Regression: `scripts/tests/role-match.test.mjs` first failed with 0 instead of 5. It covers exact titles, SFDC alias, CPQ / Revenue Cloud specialization, administrator separation, unrelated developers, and fallback preservation.

Validation: 51 focused role/library/WhatsApp/quality/journal tests passed; 71 broader resume/keyword/REA tests passed (overlapping suites, not a unique combined count). TypeScript, scoped ESLint, and production build passed. Build emitted nine tracing warnings in existing unrelated routes. Release pending. No live WhatsApp message or email sent. This does not establish 98% content alignment or resolve the exact October 17 failed-run trace.
