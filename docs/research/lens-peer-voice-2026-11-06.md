# Lens PEER_VOICE v3, rebased onto the JEV route-table master

6 November 2026. Source and artifact analysis, then a code change. This is Lens. It is not Answer Quality System 3, and it does not edit the route table in `src/lib/kompasJevRoute.ts`.

## Request

Eshwar's 5 November 2026 note (t32u, about 6:32 PM CT, with Fold 2 at about 7:47 PM CT and Fold 3 at about 7:51 PM CT) asks Kompas answers to sound like a teammate sharing real work: a bottleneck, a consequence, advice, a warning, or an inner check. One move, not a list. No invented war story, bad-advice episode, or number.

This task applies only the unpublished PEER_VOICE v3 patch. Its sha256 is `995e2c5ab4bb412b348eabe53d23e3c18b749f44801873fd185984c749dcf169`. v1 and v2 were not applied. The original unpublished base was `lens-final-8b14` / `fa8f7026`. That commit was not pushed. The change is rebased onto current master `eae0b30` (PR #245, the route table). The pull request stays open.

## What already existed on eae0b30

`REALISM` is R1–R6 plus the later NUMBERS (hard) sentence. 161 words. The spoken block does not contain the older phrase "a number the question quotes is not a source". That phrase is what two lens r3 checks and one lens r4 check still look for. Those three failures are on `eae0b30` before this change. `REALISM` was left byte for byte as on that commit.

`lensBlock` in `src/lib/kompasAudience.ts` is what the desktop lens switch appends. `audienceGuidance` includes it only when `KOMPAS_DESKTOP_LENS` is `on` or `1`. A logistics ask (address, visa, location, relocation, pay, start date) makes `lensBlock` return empty. The route table, the resume tailor, WhatsApp send, dictation repairs, and the three profiles were not part of this slice.

## What changed

`PEER_VOICE` is its own constant, 97 words, appended in `lensBlock` after `REALISM`. It tells the model to pick the one move the question is asking for, to use a sourced line when the sources hold it, and otherwise a habit. It forbids an invented war story, a bad-advice episode, and a number.

The offline composer adds exactly one shop-talk line on standard and deep answers, through `peerVoiceLine`. Order: the kind the question names, when a sourced line exists for it; otherwise any sourced line (bottleneck, warning, consequence, inner check, advice); otherwise a habit for that kind. Simple answers do not get the line. They stay picture-first. `realismMarkers` records `shopTalk`. No dated incident is invented to fill the line.

One rebase note: the v3 test calls `audienceGuidance` and expects the block. On this master that function includes `lensBlock` only while the switch is on, so the test sets `KOMPAS_DESKTOP_LENS=on`, the same way lens r1–r3 already do. The block text is the v3 text.

## Not changed

`REALISM`. The route table. System 3 retrieval and rerank. `PHRASE_FIXES` and `REPAIRS`. The resume tailor and the WhatsApp send path. Desktop sign-in. Profile identity: eshwarjay05 (Houston, LinkedIn jayy-eshwar), jayeshwar44 (Saint Louis, LinkedIn jay--eshwar), and eshwarjay06 stay apart. parfAct was not a track. Open pull requests 238, 241, 244, and 234 were not merged.

## Offline check

`node --experimental-strip-types --test scripts/tests/kompas-lens-peer-voice.test.mjs scripts/tests/kompas-lens-r1.test.mjs scripts/tests/kompas-lens-r2.test.mjs scripts/tests/kompas-lens-r3.test.mjs`

- peer voice: 4 pass, 0 fail
- lens r1, including T1–T5: 9 pass, 0 fail
- lens r2: 8 pass, 0 fail
- lens r3: 12 pass, 2 fail, the same two as `eae0b30` before this change (prompt checker `quoted-number`, still 540 hits, and the REALISM phrase the metrics contract no longer contains)

Logistics and the default-off switch suite also passed. `tsc --noEmit` was clean. ESLint was clean on `src/lib/kompasAudience.ts`, `src/lib/plan-vision-journal.ts`, and `src/lib/rea-register.ts`. This is not a live model answer, not a Windows desktop session, and not a WhatsApp send.

## Limits

The composer is a deterministic stand-in. It does not prove a live model will pick one move. The two r3 failures stay until someone is asked to edit `REALISM`, which this task was told not to do. Implementation commit `fc577906`. Pull request 246 is open and was not merged. Production was not deployed from it.
