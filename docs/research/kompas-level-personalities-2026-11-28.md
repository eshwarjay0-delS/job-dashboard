# Kompas level personalities — 28 November 2026

## Request

Owner task, 28 Nov 2026: distinct per-level personalities for Kompas, plus an eval. Architect is about 1000 words and up, first person, with architecture, components, tradeoffs, and a step-by-step. Director is 400–600 words on the business, the operation, the stakeholders, the risk, and the result, with no build-level detail. Technical HR / Engineer is 700–800 words, warm and concrete. Introductions always complete. Design answers are a spoken walkthrough.

Add-on the same day: every level is first person, confident, and decisive. No hedging and no gap admission. A tool that is not on the Houston resume is a realistic story inside the real Houston role: the customer or partner already had the tool, and he worked with it, integrated it, or troubleshot it. That story still must not invent an employer, a title, or a role, and must not claim he was employed by a company the Houston resume does not name.

## What was built

New modules, not a change to the answer route:

- `src/lib/kompasLevelPersonality.ts` — bands, Houston resume allow-list, banned closers, hedge family, employer and title check, fallback, and `applyPersonalityFilter`.
- `src/lib/kompasLevelPersonalityPrompt.ts` — prompt fragments the route can send later.
- `src/lib/kompasLevelPersonalityCopy.ts` — spoken fallback text.
- `scripts/kompas-eval-levels.mjs` and `docs/kompas-eval/levels-results.md`.
- `scripts/tests/kompas-level-personality.test.mjs`, wired in CI.

The route hook, when the in-flight answer-route change is no longer editing those files, is:

```ts
import { personalityPrompt } from "@/lib/kompasLevelPersonalityPrompt"
import { applyPersonalityFilter, personalityContract } from "@/lib/kompasLevelPersonality"
```

## What was deliberately not edited

PR #613 (`cursor/kompas-live-level-4bde`, cloud agent bc-27fe7160) is still open. Its files were left untouched: `TODO.md`, `docs/completion-watch.md`, `scripts/tests/kompas-level-contract.test.mjs`, `scripts/tests/kompas-relevance-folds.test.mjs`, `src/lib/kompasAnswer.ts`, `src/lib/kompasAnswerService.ts`, `src/lib/kompasDissection.ts`, `src/lib/kompasLevelContract.ts`, `src/lib/kompasResume.ts`, and `src/lib/plan-vision-journal.ts`. The Plan & Vision journal entry for this work is this note, because that journal file is in the other diff. `src/lib/authDisabled.ts`, the Gmail snapshot fallback, `ChatGPT.md`, and `copilot/api/_delivery.js` were not touched.

## Source of truth

`src/lib/kompas-houston-resume.txt` for eshwarjay05. It names no client company. The spoken title is Fortinet AWS Cloud Networking Engineer. The work is FortiGate-VM, high availability, Gateway Load Balancer, Transit Gateway, the Cisco FTD to Fortinet migration across six AWS regions, FortiManager, FortiAnalyzer, NERC CIP, and zero-downtime cutovers. The wider cutover was a team effort. Saviynt, Accenture, and Charter are not employers. Saint Louis and jayeshwar44 are not this profile.

## Eval

21 rows: 7 questions × 3 levels. Columns include word band, employer, banned phrases, on topic, hedges, and style. This environment had no usable model key. The results file says live samples were not produced. The transcripts in that file are the deterministic fallback from the script, not model completions.

## Verification

No UI change in the first pass. The answer route did not call these modules yet.

## 28 November 2026 — wired into the answer route

PR #613 merged as 593dff29 and deployed. PR #618 merged as 35c1400e without a deploy. The file `Eshwar_Resume_Sr_Cybersecurity_Engineer` is not in the repo, so the empty-session default remains `src/lib/kompas-houston-resume.txt`. The answer route now calls `personalityPrompt`, `personalityContract`, and `applyPersonalityFilter` after the older length caps. Brief introductions and quick facts stay on the smaller budget. IAM, Saviynt, Sentinel, and SQL injection are not narrated as past events, because the Houston resume does not record them. The answer stays on the Fortinet network work and may name the asked tool without inventing the incident. Server only.
