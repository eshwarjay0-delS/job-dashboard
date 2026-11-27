# Kompas extension guard source review — 26 November 2026

## Scope
Static review of two draft branches only. No code was changed, merged, deployed, or run.

## PR #475 — 30-fold fixture and answer-extension path
- Exact reviewed head: `ab4c7ac9d0bc69c1d7501e536f71fd869e4a7d87`.
- New COMMENT review: [6081893415](https://github.com/eshwarjay0-delS/job-dashboard/pull/475#pullrequestreview-6081893415).
- `finishSpoken()` applies `spokenAfterModel()`, then when short appends `extendFromModel()` output and returns it without rerunning the final presentation/grounding gate.
- `extendFromModel()` builds its allow-list from resume, JD and question. Interviewer/JD-only proper nouns and numeric details can therefore be accepted as allowed context despite not being candidate evidence.
- Example negative case: a question that mentions “5 regions” must not authorize an answer claiming “I led the 5-region rollout” unless the resume/explicit candidate confirmation independently supports that action and metric.
- Recommendation: reapply the final candidate-evidence gate to extended output, or constrain factual allow-list to resume/confirmed facts; add tests for employer/tool/metric details appearing only in the JD or question.

## PR #483 — Long fallback and question provenance
- Exact reviewed head: `d80f15d4833054394bd98fc37dabe09b0aa1a44b`.
- New COMMENT review: [6081895244](https://github.com/eshwarjay0-delS/job-dashboard/pull/483#pullrequestreview-6081895244).
- `inventedClaims()` treats `resume + question` as its evidence bag, so interviewer-supplied terms and numbers can pass as candidate facts. A question naming 21 FTDs or 6 regions is not proof the candidate personally migrated that count.
- Existing comments on the same draft already cover the first-open-session mismatch, cache-stamp CI failure, contact-line leakage into Long padding and repeated generic safety padding. Those findings are not repeated here.
- Recommendation: separate question context from candidate evidence; validate first-person tools, employers, counts, actions and outcomes against resume/explicit candidate confirmation. Keep long fallback relevance, privacy, naturalness and factual support independent from word-count checks.

## Validation and limits
- This was remote source/diff inspection, not execution. No local checkout, dependencies or installed Next.js 16.3.8 documentation were available; local tests/build were not run.
- Both PRs remain unmerged and are not production. No live model answers, 10/30-fold run, user device test or human grading occurred.
- Keep these comments as review findings; they are not merge approvals.

## Next
Continue the P0 WhatsApp durable same-account selection/fallback repair only when the compliant checkout and installed Next.js route-handler guide are available. Preserve #591's failing policy assertions. Restack #475/#483 on current master and rerun exact-head tests before any release consideration.
