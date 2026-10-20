# Resume score/count audit — 20 October 2026

Owner baseline: report actual exported-document coverage, preserve substantive experience checks, and do not manufacture a passing score. The weighted-scoring work remains present as a separate signal.

The prior final quality call used `round(weightedCoverage * totalTerms)` as the matched count. A reproducible fixture with 20 matching weight-3 terms and one missing weight-1 term has weighted coverage 60/61 (98.36%) but actual coverage 20/21 (95.24%). The prior conversion reported 21/21 matched while also listing one missing term.

The quality call now uses the actual matched set length and separately retains the weighted ratio. Both raw and weighted coverage must meet the unchanged 95% floor or 98% target; neither is rounded before the decision. Invalid supplied weighted ratios fail closed. Partial and unchanged-result safeguards remain. Cache generation 16 prevents reuse of earlier classifications; it deletes no saved resumes.

24 initial regressions passed, including the actual weighted matcher, raw/weighted divergence, invalid ratios, and threshold boundaries. Full regression, typecheck, lint, build and deployment checks pending. No provider generation or real email/WhatsApp send occurred. This is not evidence of 98% live output quality or reproduction of the exact 17:28 failed run.

Validation checkpoint: 65 regressions passed across keyword extraction, quality, repair, format preservation, structure, provider-lane/cache contracts and REA register. TypeScript, scoped lint, whitespace validation and full production build passed. The matcher fixture uses normalized lowercase technical terms, matching the pipeline input shape. Deployment remains pending.

Next: inspect fresh authenticated baseline/JD/confirmation/export evidence and the original failed-run trace. Direct Vercel runtime inspection remains blocked by project-team access as recorded previously; do not repeat unchanged access attempts. Kompas work remains with its separate delivery task; no Kompas behavior is changed here.

Release: `01bbc8c64ab2b5565bad3a004437ba3347ee2667` received Vercel GitHub commit status success on 20 October 2026. Deployment: https://vercel.com/qu4ntum-s-projects/job-dashboard/46ZCRc9GMT4AyATkVVnvXaqL4u65. Public `/api/health` returned HTTP 200. This supersedes the pending release checkpoint; it does not prove fresh authenticated generation quality or downloads. Runtime-log monitoring remains unverified because of the recorded team-access wall.
