# Confirmed-skill attribution review — 27 November 2026 (run 22)

## Scope
Review the approved cross-role confirmed-skill resume/JD alignment in PR #598 for candidate-evidence attribution. The JD remains target context; only source evidence or explicit candidate confirmation can support a skill. Confirmation cannot invent employers, projects, actions, outcomes, dates, titles, locations, contacts, metrics or credentials.

## Remote validation
PR #598 head `58c10bad1ee578cbc35293c34b8f4286ae11c930` has five SUCCESS gates: full CI `45934051962`, focused confirmed-skill regression `45934051966` (56/56), WhatsApp recovery `45934052043`, Kompas baseline `45934051955`, and Plan/REA schema `45934051996`. This is remote source regression evidence; no local execution or real resume/JD/DOCX acceptance.

## Static finding — passive third-party attribution
The current split pattern recognizes passive clauses only when the actor is one of a fixed list preceded by `my/the/our/their`. A phrase like `I used AWS and GCP was used by others` appears not to match the passive-actor pattern because `others` is not included; the whole first-person sentence can therefore be retained and GCP counted as candidate evidence. Similar wording with `someone else` or an external vendor may bypass the splitter. This is a source-traced risk, not a locally executed parser result.

A COMMENT review was posted on PR #598 (review ID `6083779719`, anchored to the exact head) asking for negative regressions for others/someone else/external vendor/contractor and fail-closed handling while preserving normal candidate lists such as `I used AWS and GCP`.

## Release boundary
PR #598 is not merged or deployed. Independent review, protected preview, owner-authorized original resume/JD/explicit-confirmation bundle, model generation, and exported DOCX inspection are still missing. No live 95–100% or 98% match is claimed.

## Next
Continue: fix the attribution bypass with behavior-level negative tests in a compliant checkout, rerun exact-head CI, then require independent review and protected preview. Keep the candidate-evidence boundary strict and do not generate or export a real resume without the owner-authorized bundle.


## Follow-up correction (27 Nov 2026, 05:22 UTC)

Source commit `141590c8c5acf45bf56131b46325a3474cc180c2` broadened the passive actor matcher for `others`, `someone else`, `another/other team or vendor`, external/outside/third-party actors and `handled`. Test commit `1b2a68fa8dfec01e226a68e6f9ed88f8b713a42d` adds six negative cases. Exact-head Kompas baseline and Plan/REA schema passed; focused, full CI and WhatsApp recovery are still in progress. No local execution. Keep the PR unmerged pending terminal checks, independent review, preview and real DOCX acceptance.


## Gmail privacy review follow-up (27 Nov 2026, 05:24 UTC)

Static source review of PR #576 found a potential cross-account cache leak: `shared`/`inflight` are module globals without an owner ID; the hook uses cached data before checking `snapshotKey()`, and auth-state account changes do not invalidate them (only the explicit sidebar signOut does). COMMENT 6083838182 requests owner-bound cache/inflight and an A→B session-switch regression. This is not a reproduced incident. #576 full CI 45944935727 was in progress with 44 steps green; baseline 45944935730 passed. No local or live Gmail acceptance.


## Additional edge case — bare plural passive actors (27 Nov 2026, 05:29 UTC)

The latest matcher still fails to split these conjunction cases:
- `I used AWS and GCP was used by contractors`
- `I used AWS and GCP was handled by subcontractors`

The actor alternatives cover `a contractor`, `other contractors` and related phrases, but not bare plural `contractors`/`subcontractors`. The conjunction splitter does not trigger, so the entire first-person statement may be retained and GCP incorrectly treated as candidate evidence. I reproduced the split behavior in an isolated matcher simulation copied from the source regex; no repository parser or test suite was run.

COMMENT review `6083882072` requests negative regressions, safe split/rejection of the non-candidate clause, and retention of the preceding candidate assertion (`I used AWS`). Ordinary `I used AWS and GCP` must continue to pass.

Exact-head status remains: focused `45945333982` (8/8), WhatsApp recovery `45945333791` (9/9), baseline `45945333814` and schema `45945333780` SUCCESS; full CI `45945333802` IN_PROGRESS. No local parser execution or real resume/JD/DOCX acceptance.


## Terminal gate status and new review hold (27 Nov 2026, 05:33 UTC)

All five remote checks on PR #598 exact head `1b2a68fa` are SUCCESS: full CI `45945333802`, focused `45945333982` (8/8), WhatsApp recovery `45945333791`, Kompas baseline `45945333814`, and Plan/REA `45945333780`. However, these tests do not cover the new finding in COMMENT `6083882072`: bare passive actors `contractors`/`subcontractors` can leave the conjunction unsplit. Keep PR #598 unmerged until this edge is fixed and exact-head tests rerun. No local execution or real resume/JD/DOCX acceptance.
