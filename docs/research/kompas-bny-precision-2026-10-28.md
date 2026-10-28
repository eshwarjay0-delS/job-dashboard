# Kompas interview expression fidelity — 28 October 2026

## Approval and source method
The owner explicitly requested answers that address the exact question, preserve relevant keywords, sound genuine, and stay evidence-based. Research compared an owner-provided private Security Analyst III timeline export against current MFit code. This private transcript is not copied into the repository. The canonical engine remains MFit Kompas, with no parallel perfACT backend.

## Observed failures
- A personal fit question received a CISO/KPI checklist rather than actual relevant experience.
- A multi-part risk question lost evidence validation and fabricated a NIST SP 800-53 residual-risk subtraction formula, outcome measures, and signoff requirements.
- Prior candidate speech was prepended to a new policy deviation question.
- A framework-preference answer introduced an unrelated named individual and incorrectly described NIST CSF 2.0 as having five functions, versus the six in official NIST materials.
- A personal example invented an AD/firewall incident and numerical improvements.
- Director prompting and structural repair independently forced decision-owner and KPI language, even when not requested.

## Feature-branch changes
1. src/lib/kompasInterviewPrecision.ts identifies explicit facets from the exact interviewer question; synonyms pass; broad introductions, role-fit and closing questions do not cause technology keyword stuffing.
2. New question isolation runs after the existing intake; the old JUST SAID raw utterance is removed from the generation prompt, while real history remains for follow-ups.
3. Dynamic precision guidance demands a direct answer, natural one-paragraph voice, honest source-backed stories, and no invented incidents, figures, ownership or KPI performance.
4. Director mode no longer forces a decision owner or metric when unasked. Structural repair and its old regression were updated together.
5. Compound questions with a missing requested facet enter the existing minimal repair pathway; a repair must reduce omissions without introducing new ones.
6. Conservative final corrections address NIST CSF 2.0 function-count mistakes, a fictitious 800-53 risk formula, and visible spoken stage markers.
7. Completed output includes diagnostic question-coverage and spoken-quality flags in JSON/SSE metadata.
8. A new scripts/tests/kompas-interview-precision.test.mjs suite includes 20 cumulative cases plus specific contamination/correctness/format regressions.

## Limits
The timeline export contains unverified model-generated candidate claims. Neither a prompt nor a regex establishes that a claimed personal incident really occurred. Twenty cumulative unit-test folds are NOT twenty actual model responses or live deployments. Provisional streaming model tokens may reach UI/TTS before the final correction; an authenticated live speech test remains necessary.

## Release gates
Run TypeScript, Kompas baseline, focused 20-fold suite, full hardening, and build. Confirm preview and compare actual generated answers on consented source/resume/JD contexts, measuring response relevance, exact subparts, factual claims, first-word latency, and final TTS. Verify production deployment separately from PR merge. Preserve parallel voice/native work.

## Release evidence — 28 October 2026
- PR #109 merged into master at 60062b4c0bf2788d3f9db6b23237cdf3fbeddc77.
- GitHub CI run 40765788005 succeeded: lint, type-check, 20 cumulative precision folds, adjacent Kompas and WhatsApp verification, and final Webpack build. The earlier Turbopack font-import issue in GitHub Actions was addressed by using the documented Webpack build path for CI; Vercel preview builds were READY.
- Vercel production deployment dpl_2vxG1pT6ZcrqhqfGnZzbSQ6t5uC8 reports READY on exact merge SHA, alias job-dashboard-fawn.vercel.app.
- Authenticated live-model answers, Windows native voice, provisional stream TTS, and practical end-to-end response improvement remain unverified; do not claim otherwise.
