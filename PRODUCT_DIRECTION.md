# MarketFit product direction — 2026-10-02

This records the user's current requirements. Where older handoffs conflict, these current instructions take priority. In particular, do not invent metrics, seniority, employers, tools, or skills to improve keyword coverage.

## Simple navigation

MarketFit is the main application. Resume preparation and job email are the two primary dashboard destinations. Kompas interview practice stays easy to find as a secondary tool. WhatsApp, mobile web, the browser extension, and future messaging clients are access channels for the same capabilities, not competing product sections. Keep model metrics in optional details.

## Resume preparation

**Superseded by the owner, 2026-10-05:** "Should treat resume + his version JD as combined. that's the rule." The resume and
the job description together are the candidate's record: every skill, tool and responsibility the JD lists is theirs and is
shown in the skill lines and in the bullets of every role where it fits, with new bullets added where a role can't carry them.
Identity still comes only from the resume (name, employers, titles of past roles, dates, years, seniority, certifications,
degrees, clearances, work authorization), a JD's stack is added beside the real one rather than replacing it, and no metric
is invented. This is J1 `j1.resume.v3`. Where the paragraph below says otherwise, this rule wins.

Begin with the user's original baseline for each new JD. Preserve its identity, job titles, formatting and structure. Emphasize supported experience using clear human language. The user clarified that submitting a JD confirms knowledge of its explicitly listed skills and technologies. Include those in existing skills lines and relevant summary wording even if absent from the baseline. This does not establish employer-specific use, years, certifications, degrees, clearance or work authorization. Experience with Azure does not authorize changing an employer history to AWS. Do not generate plausible metrics or fictional incidents. Show changes for review and retain the baseline. Keyword coverage is not an ATS acceptance probability or a factual-accuracy score.

## Email target, not a claim of current functionality

Support up to four connected Gmail accounts, a job-only inbox, interview-only calendar, and application statuses. Rejected applications leave the active view but retain history; do not silently delete mail. Save editable weekly availability, generate drafts, and send on approval. Automation is explicitly opted into, scoped, ordered and scheduled, with retry/idempotency controls. The current combined inbox, calendar and workflow sample pages are previews, not verified implementations of this target.

## Authentication and boundaries

Keep Google sign-in and email magic links through Supabase. Verify identity on the server, check ownership independently for every resource, and deny access on missing/invalid sessions. Login does not grant Gmail read/send permissions. Request each integration scope separately. Never substitute a shared demo identity after authentication failure. Migrate legacy files to verified owners explicitly; do not guess ownership from filenames. Production release requires two-account isolation checks and verified OAuth configuration.

## J1 AI harness and Jev

The user confirmed J1 means a versioned code policy module, not a visible header or another model. Use deterministic logic for authorization, arithmetic, budgets, schemas and action permissions. Jev may classify narrow, atomic questions using minimal structured context and route uncertain decisions for review. Validate outputs and fall back on timeout or malformed responses. Confidence never grants permission and must be evaluated on held-out data before using thresholds for automatic actions. Keep provider credentials on the server.

## Kompas voice

Microphone and explicitly shared system audio must have clear lifecycle controls. Preserve final phrases, short answers, chronological output and session isolation. Explicit corrections may improve the session vocabulary; do not market this as continuously retraining Whisper or as perfect accuracy. Verify with representative accents, noise, interruptions and microphone/system-source switching. The separate transcription backend remains outside this repository's verified source access.

## Strategy documents

Apply the user's uploaded architecture/interview/virality transcripts through small complete features, simple first-use paths, bounded model context, tested fallbacks, and measured quality. The transcripts are automatically transcribed strategy inputs, not authoritative SDK specifications; use current primary documentation for integration details. Do not copy claims of zero hallucinations or guaranteed calibration into product promises.
