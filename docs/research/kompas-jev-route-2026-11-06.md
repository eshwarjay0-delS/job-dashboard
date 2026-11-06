# Kompas route table in front of answer generation

6 November 2026. Source and artifact analysis of the live answer path, then a code change. Not a TypeSafe Jev call, not a new vendor, and not a live model or desktop session.

## Request

Put a thin route table in front of Kompas answer generation. Classify the question, read the retrieval confidence the coverage gate already computed, and choose go, confirm, or stop before a generation call. Jev here is that decision style. Do not add TypeSafe hosted Jev or any Jev SDK. Do not redo System 3, Lens, or Answer Quality. Leave PEER_VOICE, the resume tailor, profile identity, dictation repairs, and silent desktop sign-in alone.

## What the path already did

`answerForVerifiedUser` in `src/lib/kompasAnswerService.ts` strips personal logistics and returns the quiet card before `keysFor` and before any model fetch. `interviewIntent` classifies the ask. `questionDepth` and the selected listener set depth and audience. `retrievePassages` sets `matched` when an experience passage covers at least half the topic words, and `missing` when one part of a split ask is uncovered. A miss still generates, with the existing "not in your sources" prompt. A zero score is not proof the resume is empty: "Walk me through an incident you handled" scores zero against a resume that describes incidents, and the grounding fold still expects that call.

## What changed

`src/lib/kompasJevRoute.ts` is the table. First matching row wins. One action.

- Out of lane (the personal-logistics strip, not the broad "logistics" label) stops at every class and every band. The service's existing quiet return is that stop. Address, visa, location, and relocation stay out unless the resume already said them and the question kept that clause.
- Experience-story plus middling confidence confirms when the live answer card is the surface. Middling means `matched` with a named missing part, or a positive score that did not clear the half-topic gate. The spoken line is the existing confirm blank, `I would want to confirm that`, with no new card.
- Without that surface, the same row goes, so a caller with nowhere to show the line still generates.
- A full match goes. A total lexical miss on an experience story also goes, because that is the existing not-in-sources generation. Definitions, scenarios, introductions, and the other classes go at every band.
- Depth is `questionDepth`. Audience is the listener level already chosen for the turn. Neither spends a call.

The service calls the table after `retrievePassages` and before `paidKeyNow`, `streamAnswer`, and `jsonAnswer`. Confirm returns that one line on the existing text channel and does not fetch a model. Go is the previous generation path, unchanged.

## Not added

No `typesafe` package, no `jev-1` model id, no `TYPESAFE_API_KEY`, no hosted Jev. No PEER_VOICE. No Lens or System 3 edit. `PHRASE_FIXES` and `REPAIRS` were not edited. The resume tailor was not edited. Desktop sign-in was not edited.

## Offline check

`node --test` on the new route suite plus logistics, grounding (including the 30-fold), System 3 retrieval, speed r6, source retrieval, and relevance recovery: 224 pass, 0 fail. `tsc --noEmit` clean. ESLint clean on `src/lib/kompasJevRoute.ts` and `src/lib/kompasAnswerService.ts`.

## Limits

Not a live model answer, not a Windows session, and not a production deploy. The confirm line is the existing spoken blank, not a new clarification dialogue. A lexical miss still spends a generation call on purpose.
