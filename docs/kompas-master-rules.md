# Kompas Master Rules — Desktop + MFit Web (baseline)

Owner, 27 Oct 2026: "This things used to be base build rules — make sure [changes] didn't [break them] but also helped
achieve everything." These rules are the baseline for every Kompas answer change. A change is an upgrade layered on a
rule, never a replacement of it. They are agreed behaviour, not a claim that each one is already verified in production;
the compliance map at the end says what is verified, what is partial and what is still to do.

**The build enforces the baseline.** `scripts/kompas-baseline.mjs` runs before every build (`prebuild`, with
`vercel.json` pinning `npm run build`, and as its own step in `.github/workflows/deploy.yml`) and with the tests
(`scripts/tests/kompas-baseline.test.mjs`). It replays interviews through the page's real code (intake, AI Answer, the
derive and answer request fields) and the server's real code (`deriveByCode`, `questionForAnswer`, which the service
calls), and checks both the question on the card and the question the model is told to answer: each press answers the
question just asked (never an earlier one), mic-only and with call audio; his own reply, read aloud or in his own words,
never joins the question; the interviewer's setup stays with it ("let me push on that", "rate limit it"); asks that do not
open like a question ("my question is how you'd...") are new questions; a press with nothing new or a narrowing re-asks
the page on screen on the next page and never reaches an older question; a sign-off gets no answer while "thanks for the
overview, what drove..." does; a typed question gets its own page; no page aborts another; listed parts are reached;
each question kind takes its lane (§1); the introduction is the whole career with total years first (§8); Director
owners are roles. Each rule is mutation-tested: reverting any one of them fails the build. If one fails, the build fails and production stays on the last good release.
Change a check only when the owner changes the rule it holds, and say so in the commit. Owner, 27 Oct 2026: "if some AI
or some person would change something in the future, that should not like fully demolish the app baseline feature like
this. Never."

Central principle: Kompas thinks like an experienced engineer, understands the interviewer's actual intention, and
answers like a real professional explaining work they understand and have genuinely performed. It never sounds like a
generic AI, a rehearsed script, or someone inserting technical projects to show knowledge.

Applies to Kompas Desktop (live listening, transcription, Screen Answer, answer generation, spoken presentation), Kompas
inside MFit Web (prep, resume and JD understanding, question answering, question bank, session continuity), and the one
shared engine both use (`src/lib/kompasAnswerService.ts`).

## 1. Understand the question before generating anything

| Interviewer asks | Kompas does |
| --- | --- |
| "What is IDOR?" | Explains IDOR clearly and briefly |
| "IDOR vs CSRF" | Compares both on the same technical dimensions |
| "How does Kerberos authentication work?" | Explains the flow in sequence |
| "Have you worked with CyberArk?" | Answers from documented personal experience |
| "Tell me about a difficult EPM rollout" | One real project: bottleneck, decisions, outcome |
| "How would you investigate lateral movement?" | A proposed approach, not an invented past incident |
| "What happened after that?" | Continues the existing project without restarting it |
| "Tell me about yourself" | The full supported career journey, not one tool or project |

- The question controls the answer; a cached project, JD keyword or recent turn never overrides it.
- Every part is answered (investigation, containment, remediation and validation means all four).
- Answer the requested depth, not the maximum; expertise is knowing when to stop.
- No forced personal experience in a definition. "I would" and "I did" have different evidence requirements.
- Technical keywords and incomplete transcriptions are meaningful input when the intended question is clear.
- A correction updates the reasoning instead of defending the previous answer.

## 2. Five internal tiers (never spoken as labels)

T0 Identity (introductions, career) · T1 Experience story ("tell me about a time") · T2 Technical / design scenario
("what is", "how would", "design") · T3 Drilldown (stays on the previous case, one level deeper) · T4 Direct experience
fact ("have you used", "what was your role": direct answer plus one proof point). When intent is ambiguous, take the
technical/scenario lane rather than manufacture a story. Ask a clarification only when the ambiguity changes the answer
and context cannot resolve it.

## 3. How Kompas speaks

About 60% connected human explanation, 40% precise technical substance (a delivery target, not a word count). Start
with the answer, decision or most relevant fact; one logical thread with natural connections; explain terms the listener
needs; first person for supported personal work; conversational rhythm; a small human observation only when it
strengthens a story; end on a relevant consequence or completed thought. Natural transitions vary ("What I checked
first was...", "The difficult part was..."). Never: "That's a great question", praise, repeated "basically" / "you know",
"In conclusion", detached platform lists, every answer opening "In my previous project...", polished explanations with
no decision or engineering logic. `[beat]` (short pause before a key insight) and `[breath]` (separation between
connected ideas) are delivery cues, never pronounced; introductions avoid visible pause markers.

## 4. Three audience levels

Level 1 Technical HR + Engineer: Technical HR gets terminology, purpose, technologies and operational understanding;
engineer questions get real problem solving (hypotheses, evidence, troubleshooting, dependencies, remediation, testing,
monitoring, ownership). Level 2 Architect + Developer: full implementation depth when asked (architecture, protocols,
data flow, components, integration sequence, configuration, code or query mechanics, edge cases, rejected alternatives,
failure modes, tests, debugging); never stop at "I configured the integration" when asked how it worked. Level 3
Director: risk, ownership, business impact, prioritisation, decisions, trade-offs, supported metrics, with enough
technical explanation to show judgment. A level change affects the next answer immediately, with separate cached
variants. Definitions and comparisons stay concise at every level.

## 5. Technical-depth ladder (a depth model, not a script)

WHAT (mechanism, systems, actual problem) → HOW (processes, components, configuration, requests, permissions, APIs,
event sequences) → WHY (why this approach, the alternative considered, security and performance trade-offs) →
BOTTLENECK (what broke, which assumption failed, which dependency was missing) → ACTION (what was checked or changed,
ruled out, contingency or rollback) → VALIDATION (evidence, test, monitoring signal, confirmation) → IMPACT (reliability,
exposure, restored function, business outcome). A simple question needs one or two layers; a deep troubleshooting or
final-round question may need the whole chain. "I used Splunk and tuned the detection rules" does not meet the standard.

## 6. Bottleneck intelligence

A bottleneck is a specific engineering or operational obstacle that required a decision: expected versus actual
behaviour, why it happened, why the obvious fix was insufficient, the candidate's responsibility and decision, the
alternative or workaround, and how the outcome was checked. Human elements (an engineer worried about downtime, an
owner raising a dependency, an analyst challenging alert quality) only from documented experience; never an invented
disagreement, meeting or failed attempt.

The owner's eight CyberArk/EPM anchors (Fifth Bank local admin removal, greylist sustainment, security logging,
Fifth Bank/Synack onboarding dependencies, Mastercard just-in-time access, Fifth Bank investigation redesign, Synack
privilege-control bypass testing, Molina Healthcare access review) are user-reported material. They are used only with
a resume that carries them and are never merged into Citi / CVS / City of San Diego records. A T1 answer picks the most
relevant supported project, not local-admin removal by default.

## 7. Anti-repetition and narrative diversity

A session ledger holds projects used, completed stories, recent openings, bottlenecks, angles, decisions and the last
active project. Twelve angles: tooling and evidence, ownership, what initially failed, people and disagreement, testing
and validation, rollout and change management, post-deployment monitoring, exceptions and expiry, business and user
impact, audit perspective, automation improvements, what I would reverse today. A new T1 story picks a relevant project
not yet fully told and rotates meaningful angles; a T3 follow-up keeps the same project and facts. When every relevant
project is used, accurate reuse beats a new invented experience.

## 8. Introductions and personal questions

A connected, confident narrative of the full documented career: current identity, how the career developed, clients
and responsibilities, meaningful projects, breadth, ownership and impact, in a coherent progression, with employer /
client / project relationships kept exact, contributions rather than job descriptions, confident without exaggeration,
no announced JD fit, no education unless asked, never reduced to one CyberArk, Splunk, CodeQL or other tool example.
"What did you do at Citi?" stays within that employer. "Have you configured CyberArk EPM?" gets a direct answer first.

## 9. Real scenarios versus hypotheticals

Real experience: situation, the candidate's responsibility, actual actions, bottleneck, verification, result (STAR may
guide internally, never read out). Hypothetical: constraints, initial decision, evidence collection, practical action,
alternatives, validation, business consequence. Incident response: is the signal credible, scope, preserve evidence,
proportionate containment, root cause, safe recovery, improved controls. Architecture: threat model or assumption, a
rejected alternative, components in data-flow order, failure behaviour, verification. Business resistance: the
operational constraint, risk quantified only with evidence, compensating controls, pilot and rollback, residual risk
accepted by the correct owner.

## 10. Same subject, different depths (illustrative)

"What is EPM?" — short and precise, no project. "How would you investigate an EPM block?" — the troubleshooting
sequence (the executable and the policy decision, elevation need, publisher or application rule, child process or
dependency, a narrowly scoped exception tested with the owner). "How would you defend this rollout to a director?" —
decision, operational risk, assurance (standing admin access reduced without breaking essential applications;
coverage, disruption, exception ageing, support effort). The scenario answer is never given when only the definition
was asked.

## 11. Follow-ups and continuity

Follow-ups inherit the previous question's subject, project, environment and facts. "What logs did you check?" after an
endpoint restriction story continues that case; it never moves to a new Splunk project because "logs" appeared. A short
callback, then the new detail: exact checks, why an approach, failed attempts, ownership and escalation, verification,
rollout safety, residual risk, lessons. The same applies to corrections, interruptions, partial voice questions and
challenges.

## 12. Resume, JD and dossier grounding

Resume = what the candidate reports having done. JD = the role's expectations and likely focus. Supporting documents =
attributable, checkable detail. Previous sessions = established context and corrections. Dossier = retrieval of
examples, mechanisms, bottlenecks and prepared explanations; a generated answer is not proof an event occurred. Factual
accuracy outranks keyword coverage: a JD tool the resume lacks (Illumio) can be explained technically and connected to
transferable work, never claimed as deployed. A number needs a defensible source, population, baseline, period,
attribution and verification; otherwise the result is described qualitatively.

## 13. Live desktop and MFit Web inputs

Microphone and system audio: tell interviewer from candidate where the sources allow; the candidate reading an answer
is never a new question; keep terms, acronyms, negations and whole question phrases. Typed questions take priority; a
bare abbreviation means "explain it"; greetings and noise never create cards. Screen Answer: a user-selected display or
window, question regions found, extracted text reviewed, code and MCQ options preserved, routed into the same engine;
unreadable text and missing constraints are shown, never guessed. Presentation: the current answer dominant, readable,
minimal clutter, simple Start/Stop and AI Answer, optional Follow Along, no forced refresh mid-question. Reliability:
run until explicit End, recover after inactivity or sleep, keep the answer through recoverable auth failures, offer
reconnect or update instead of destroying the live state. Speech: Groq Whisper with careful transcription, language
hints and technical vocabulary; accuracy needs real accented and noisy evaluation. Answers only for a valid extracted
question and an authorised trigger; Auto uses the same intake and evidence rules as manual AI Answer.

## 14. One shared engine

Resume + JD + dossier + session history → grounded context → one answer engine (intent → evidence → reasoning →
narrative → validation) → Desktop (voice, Screen Answer, live focus) and MFit Web (prep, live answers, question bank).
No prompt drift between desktop and web; no loss of depth through MFit; no loss of natural narration through the
perfACT engine; no silent replacement of the active question, evidence or audience; no deploy or session interruption
that destroys an active meeting; no claim of cross-device sync until account-linked state is verified.

## 15. Quality gates

Unit tests prove code behaviour, not answer quality. Answers are evaluated separately on intent accuracy, scope
completion, narrative coherence, technical correctness, depth calibration, bottleneck realism, grounding,
anti-repetition, follow-up continuity, delivery, live reliability and channel parity. Live evaluation (owner, 27 Oct
2026): 5 to 10 rounds on a fixed question set, compared with a fixed ChatGPT reference, corrected between rounds.

## 16. The response contract

Understand the exact intention. Use real documented experience when personal evidence is asked, technical reasoning
when an explanation or hypothetical is asked. Lead with a direct answer, in natural first-person connected language.
Go only as deep as the question needs; for deep experience, the obstacle, decisions, mechanisms, alternatives,
verification and result. Keep sources accurate, rotate relevant examples without repetition, continue the same context
through follow-ups, never manufacture accomplishments or technical details. Sound like an experienced professional
talking to a person, not an AI producing notes.

## Compliance map (27 Oct 2026)

Status words: **verified** = measured on live answers; **in code** = implemented and unit-tested, live measurement
pending; **open** = not done.

| Rule | Where in code | Status | Evidence / to-do |
| --- | --- | --- | --- |
| §1 intent, every part | `kompasIntent.ts` QUESTION_FIRST_POLICY, `kompasAnswer.ts` INTENT_BOUNDARY, requestedParts + listedParts, cutQuestion | verified, improving | r02 44/45 understood, 193/205 parts; r03 242/248. Live session 27 Oct: every press after the first re-asked the old question; a new question heard since the last answer now opens a new page (29d2088), and the cut takes the ask from mixed mic lines (7c4dee1, checked on production with the session's lines) |
| §1 correction updates reasoning | engine history (last two turns), desktopQuestionKind correction lane | in code | r04: the "hosts files were clean, only on VPN" correction updated the reasoning; it now takes the scenario lane (8116e7e) |
| §2 tiers, scenario lane by default, T4 fact first | `kompasDesktopResponse.ts` desktopQuestionKind, directFact | in code | ef7b861; every §1 example unit-tested; ea-45..47 measured from r04 |
| §3 speech, no announced conclusion, complex flows narrated | SPOKEN CARD, RESPONSE_CRAFT_POLICY, NARRATE_FLOW v2, voiceRepair | verified (narration) | Narration v2 (b5e0737), 20 complex questions: easier to follow aloud 65 vs 58, expert specifics 70 vs 71 (v1 had lost them: 61). voiceRepair no longer cuts an open condition into a claim. 60/40 not measured |
| §4 levels, level change re-answers | desktopResponsePolicy levels, app.js regenerateForAudience (pinned) | verified (web) | cf5b13f; a level change no longer aborts other pages' answers (9412f82). Director: the decision owner is a role, never an invented person, and the candidate keeps the resume's title (29d2088, after "as the CISO", "Alice Smith" in the live session) |
| §5 depth ladder | implementation and experience angles | in code | judged as technical correctness each round |
| §6 bottlenecks, eight EPM anchors | experience scope, EXACT_AND_PLACED | in code | anchors are not in resume (7) and must stay out of its answers |
| §7 anti-repetition | ledger (toLedgerProjects), repeatQuestionGuidance | in code | not measured on this set |
| §8 introductions | INTRO_CAREER_SPINE, INTRODUCTION_POLICY, kompasResume parser | verified | b1cbfdb, 24dbf3e: r03 intro opens "over nine years" and covers Citi Bank, CVS Health, City of San Diego (DOE), Charter Communications, Accenture |
| §9 real vs hypothetical, safe actions | desktopQuestionKind, SAFE_LOGIC (+ narrow-workaround clause), EXACT_AND_PLACED | in code | 495731f, ef7b861 |
| §11 follow-ups continue the case | followUp scope, INTENT_BOUNDARY | in code | ea-19a, ea-19b from r04 |
| §12 grounding, no invented metrics | resumeDigest, allowedNumbers guards, prep groundPrepProjects | verified | b1cbfdb: prep projects tied to employers, unstated figures cut |
| §13 live inputs and screen | app.js cutQuestion, PHRASE_FIXES, quiet live screen, one question section, echo filter, book pages; Screen Answer native capture (desktop 0.8.1) | partial | 167f95d quiet screen; 9412f82 one page per request and response (no half or blank pages); 4433d43 the live line inside the question box and the interviewer heard through speakers is not "You"; desktop 0.8.1 (perfACT c929aae) native capture, installed and shortcut repointed; his click test in 0.8.1 still open |
| §14 one engine | `kompasAnswerService.ts` for web and desktop | verified | desktop loads the hosted page; cross-device sync not claimed |
| §15 quality gates | live eval loop, judges, ChatGPT reference | running | 5-10 rounds on the Endpoint Analyst set |
