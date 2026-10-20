# Resume display precision — 20 October 2026

## Request and method

Continue the owner's approved resume-quality work and accurate reporting. Source analysis, not a live provider test or proprietary reverse engineering. Read current master 8ec8180, AGENTS.md, completion-watch.md, resume plans and the current journal. Other developers' crawler and Chief changes are outside this slice.

## Observed defect

`src/lib/tailor.ts` rounds result score, coverage, keyword analysis and notes to integers. `src/app/dashboard/resume/result/page.tsx` rounds the match ring again. Thus 949/1000 becomes a displayed 95 even though the unchanged acceptance check rejects it; 979/1000 becomes 98 despite missing the target. The repair prompt also rounds its current measurement.

## Implementation

`coveragePercent` truncates display percentages to one decimal; invalid ratios display zero. Original ratios still govern acceptance. All shared output measurements and the repair prompt use it. The web ring and its accessible label render the same numeric measurement. No resume contents, quality thresholds, role-evidence rules or delivery policy changed. Cache generation 18 prevents serving the older rounded result fields to new requests; existing stored artifacts remain unchanged.

## Evidence and limits

Regression coverage exercises 94.9, 94.999, 95, 97.9, 97.999, 98, 99.999, 100, zero and invalid input, plus source wiring for shared fields and the web ring. Test/build and deployment results are recorded below when verified. This is not evidence that any live generated resume matches 98%, nor reproduction of the exact 17:28 WhatsApp failure.

## Next

Validation: 64 regressions passed; TypeScript and the full production build passed on the combined tree with concurrent master 1e8df26. Scoped lint: zero errors, five existing warnings. No real provider or messaging calls. Deployment verification pending.

Inspect a fresh authenticated baseline/JD/confirmation/export pair and its download. The original failure still requires its full JD, source Word file, returned artifact and execution trace. Authorized runtime logs and an authenticated test session are not available in this execution environment. No email or WhatsApp messages sent.
