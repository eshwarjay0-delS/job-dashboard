# Hitachi reference question intent repair

## Request and recovered evidence

Owner reports poor Kompas transcription and less clear/relevant answers than ChatGPT, despite providing a dossier, and requests 22–30-fold testing. The uploaded `Create Cybersecurity Interview PDF.mht` is readable. Its two copies share SHA-256 `b3baa85bdbb3a6b24a3a06554bc2fa1edb9ba87616bc9dc74744bf42e0efa988`.

The archive contains the Hitachi Senior Cybersecurity and Compliance Engineer JD, ten proposed interview questions, and links/names for generated dossier PDFs. It contains neither a full live Q&A nor Kompas's corresponding transcripts and outputs. PDF names do not prove their contents were loaded in desktop. The full private archive and recruiter contact details are not committed.

## Source finding and implementation

Three recovered experience prompts fell through `desktopQuestionKind` to `general`: “How have you managed…”; “Walk me through a critical security incident you handled…”; and “How have you applied…”. That policy caps general answers at 70–90 words and tells the model not to open a project story. This conflicts with the questions asking for actual experience.

Recognize “how have you” and a “walk me through” request explicitly tied to an action the candidate handled, managed, led, built, implemented, resolved or investigated. Keep ordinary concept/definition/comparison requests short. Experience guidance retains its supplied-facts-only rule and hypothetical fallback when no incident evidence exists. No facts, achievements or metrics are added.

## Validation and limits

The ten recovered questions crossed with the three levels produce 30 named intent/depth cases: 21 passed and 9 failed before the fix; 30 pass after it. Including the existing three-level and desktop suites yields 43/43. These are deterministic policy tests, not 30 generated-answer judgments or speech-recognition measurements.

Release status: local implementation; release validation and deployment pending. Actual session acceptance still requires matching desktop transcript/answers, original audio if available, dossier/version loaded and audience setting. Those artifacts would distinguish recognition, extraction, retrieval and generation failures. This source bug is not established as the sole cause of the reported session.

## Beta hardening continuation — 24 October

Owner explicitly requests a zero-errors desktop build. This is an acceptance goal, not a guarantee. Updated against master 3025338, preserving the whole-question and re-ask improvements. Removed the renderer substitution of a missing percentage with “significantly”, which asserted unsupported magnitude. Restored plain bold/italic emphasis without colored boxes. Replaced stale source-string expectations with actual DOM behavior checks for placeholder cleanup, technical brackets, spoken heading/code omission and HTML injection safety. The deliberate heading-omission policy remains unchanged.

Full hardening suite: 847/847 pass with no skipped tests. Focused renderer, navigation and recovered-question set: 38/38. Native Windows packaging, idle/sleep recovery, real microphone and paired model outputs are not verified by these tests. The canonical native repository must receive any applicable renderer changes before a packaged desktop release can be claimed.

Production build, TypeScript and scoped lint passed. GitHub publication and native release verification remain separate.

Release continuation: PR #60 preview succeeded, but master advanced to 131362e. Rebased preserving the concurrent full-question guard and delivery evidence; reran hardening before republishing. Native acceptance remains pending.
