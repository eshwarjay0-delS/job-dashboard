# Notebook causal-depth answer upgrade — MFit Kompas, 1 November 2026

## Product rule
There is only one production answer engine: src/lib/kompasAnswerService.ts in the canonical MFit/Kompas repository. Authenticated /api/kompas/answer, the desktop web shell, and the WhatsApp sharedKompasTurn adapter use the same service. The transcript and NotebookLM-style teaching input inform explanatory structure, not the candidate's employment facts.

## What changed
- A deterministic, low-latency causal plan selects one of nine answer routes: brief fact, comparison, technical mechanism, diagnosis, hypothetical scenario, operational decision, sourced experience, technical follow-up, or coding.
- Diagnosis separates observed signals from what they establish, competing causes, discriminating evidence, safe action and independent verification.
- Architect, engineer, director, and mixed-audience answers select different decision criteria without changing original source claims.
- The plan is appended to the shared answer system after existing source, question-fidelity and response-calibration rules. No extra LLM call or storage lookup; the existing documents-first and master/mini dossier retrieval remain authoritative.
- The previous interviewer question only can resolve references for actual follow-ups. Prior AI answers are never promoted to an incident, a measured metric or personal history.
- Non-mutating causal-output signals join the spoken precision diagnostics on both SSE and JSON. Diagnostics are not truth verification and do not rewrite sourced answers.

## Source evidence and limits
The 1 November research reviewed a 389-turn/10,225-word annotated teaching transcript, five matched recovered M4A-derived transcript files, and five acoustic cases. The recovery manifest found 17 M4A files (15 distinct) and five matched prior transcripts; other recordings remain unverified. The pedagogical lesson is: relevant discrepancy, causal mechanism, observable evidence, defensible operational consequence. Never copy third-party generated stories or numbers into first-person candidate history.

The Notebook-inspired dossier API and immutable session mini-dossiers already exist separately; this release enhances live answer reasoning rather than creating a second Notebook backend. No consumer Notebook service API is invoked.

## Release gates and live answer acceptance
- Run TypeScript, lint, new 60-case causal routing and diagnostic tests, existing 50-case narration and naturalness tests, full Kompas migration, voice, source and account-sync regressions.
- Require exact-head Vercel preview READY; merge only when all GitHub checks pass, and verify production serves the new merge SHA.
- Live-answer quality still requires consented, authenticated user-scoped POST /api/kompas/answer with submitted test resume, JD and documents. Test JSON and SSE to compare complete answer, diagnostics and timing. Do not introduce an anonymous answer endpoint, scrape cookies or send private audio to unapproved providers.
- Compare 50 baseline/new responses blindly for question coverage, factual provenance, causal accuracy, depth, decision usefulness, continuity and latency. Reject for invented incidents, unsupported metrics, drift or missing question parts. Deterministic prompt checks do not prove live model improvement.
- WhatsApp needs a verified test recipient and actual message receipts; Windows needs installed-client and real audio acceptance.

## Representative output distinctions
- Closed remediation ticket is not the same as verified effective permission removal. State a source of truth and independent recheck, without inventing observed results.
- Valid signature is not the same as an authorized session. Separate cryptographic check from account identity and policy.
- A follow-up asking for an artifact stays with the earlier case, names the evidence class first, and marks hypotheticals accurately.
- A short definition of CyberArk EPM stops without a mandatory anecdote or analogy.

No authenticated model output, Meta message delivery, or installed Windows acceptance is claimed by this record.
