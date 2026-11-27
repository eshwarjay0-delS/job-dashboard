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
