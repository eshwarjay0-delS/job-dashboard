# Kompas consistency pass — 20 November 2026

Owner request: every answer relevant, the right length, and a right panel that helps. Question capture is treated as about 60–70 percent and was not this slice. Skip-login stays on. The only off switch remains the exact value `off-confirmed-by-eshwar`. Admin routes stay locked. `fix/google-only-login-production-auth-20261113` was not merged or revived.

## What was checked

Live production recorded in the audit was `1c6c1622`. `origin/master` at the start of this work was `a6f6867e`. `git diff 1c6c1622 origin/master` on the Kompas engine files was empty. The audit's causes matched the source:

- `bookMatch` served a stored answer at keyword overlap 0.75, with an intro shortcut and no epoch or session check.
- `paintFromAnchors` and `showCachedLevel` could show stored prose with `meta` cached.
- `restoreLive` put the previous run back on screen, and a press with nothing new re-asked that card.
- `confirmSurface: true` was hardcoded, so a mid-confidence experience story returned "I would want to confirm that".
- `judgeRewrite` discarded a rewrite that introduced any new note, including a grounded one.
- `presentSpokenAnswer` capped the sentences band at two sentences. Floors existed as `aim * 0.25` and were not applied at display.
- The aside panel filled from canned lines such as "What part of this do you want first?" and the 52-seed clarify bank.

## Narrative quality is the main path

The owner ranked the regular question-and-answer path above the right panel. A good answer opens with the direct answer, then what he did and why, then the result with a number that is already in the resume. It should sound like a person who was there. It is not a First/Next/Finally template and it is not a made-up career.

`judgeNarrative` in `src/lib/kompasConsistency.ts` scores that shape. `scripts/tests/kompas-narrative-quality.test.mjs` runs seven fixtures 20 times each: two grounded stories pass; the confirm stub, the template closer, the invented QA persona, the one-sentence ransomware line, and the second-person L1 line fail. The answer prompt includes that narrative instruction for story and walk-through questions.

The "Senior QA Automation Engineer" persona is not a sample fixture and not the other profile. With no resume, `/api/kompas/prep` still asked a model to write a biography from the job title, and the model invented one. Prep now returns an empty identity when the device has no resume. A dossier is not treated as a resume.

## What changed

Caches serve only when the question, the epoch, and the session are the same. A stored anchor is not painted over a new question. A restored card is not re-asked when nothing new was heard. Mid-confidence stories generate. If the shown text is the stub, empty, or an unsupported product, the card says the resume does not cover it. A grounded rewrite that fixes a gap is kept. Display length uses a visible band: openers aim 120 (90–150), follow-ups aim 70 (50–95), comparisons aim 100 (75–125), short definitions aim 35 (22–50), definitions with application aim 98 (85–110), have-you-done aims 85 (70–120). The sentences band is no longer sliced to two sentences. The left answer drops connector prefixes, generic third person, dictionary lines, headings, and repeated sentences. The right panel is "Say this": a first-person resume line, or one clarifying question taken from the ask. Two asks in one turn are answered in order. A provider cooldown is spoken in seconds.

## Verification

`scripts/tests/kompas-consistency-20fold.test.mjs` ran each pattern 20 times. The text was identical on every fold. SOC word counts from that local run:

| Question | Band | Words | Floor | Aim | Ceiling |
|---|---|---:|---:|---:|---:|
| Led the response to a critical security incident | story | 127 | 90 | 120 | 180 |
| Investigate a phishing email | design-first | 90 | 70 | 100 | 160 |
| EDR versus SIEM | comparison | 108 | 75 | 100 | 125 |
| Contain ransomware across 200 endpoints | design-later | 102 | 70 | 100 | 160 |
| Prioritize a Qualys scan | howto | 101 | 70 | 100 | 160 |

This is a deterministic local gate. It is not a live model call, not an installed Windows session, and not a production check. The pull request has no ship marker. Production stays on the previous build until a later reviewed ship.
