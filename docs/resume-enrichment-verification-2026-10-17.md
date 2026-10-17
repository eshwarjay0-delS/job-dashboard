# Resume enrichment correction and verification

## Input contract

Use the selected baseline, explicit candidate confirmations and original JD together. A candidate confirmation can supply experience missing from the baseline. A JD alone supplies requirements, not biography. Preserve employer attribution: an unscoped skill confirmation does not prove that every historical client used that technology. Never invent metrics, credentials, dates or identity details.

Both Gemini enrichment passes now receive the baseline and candidate input. They can suggest related tools, technical phrases and work activities. Suggestions enrich wording; they do not become facts or additional requirements in the coverage denominator. The original extracted JD requirements remain the scoring set. Profile, experience and repair instructions share the confirmation policy. A new cache generation prevents earlier outputs from being replayed under this policy.

## Verification performed

Command: `node --test scripts/tests/resume-*.test.mjs scripts/tests/jd-keyword-extraction.test.mjs scripts/tests/tailor-lanes.test.mjs`

Result: 84 tests passed, zero failed. Coverage includes two Gemini prompt passes with mocked provider replies, candidate confirmations in profile and role prompts, malformed enrichment, missing provider credentials, deduplication, score boundaries, identity isolation, repair retention, formatting and actual DOCX export/extraction. Added rejection cases reproduce the displayed 17/40, 14/22, 63/260, 51/81 and 38/81 counts from the user's screenshots. These are score regression cases, not recovered historical Word documents.

Updated stale tests to reflect existing randomized WhatsApp filenames, session version 3 and separate vertical/horizontal template margins. No expected behavior was weakened to admit incomplete resumes.

## Limits and remaining acceptance work

Passing tests does NOT establish 98% live generated resume quality. Provider responses in the enrichment tests are mocked. No provider credentials were available in the local process, and no fresh authenticated production generation was performed. An authenticated live evaluation must generate against a fixed set of actual baseline/JD/confirmation inputs, download each resulting DOCX, independently measure original requirements, inspect substantive experience evidence, and compare identity and format before reporting a 95–100% achieved match. No real emails or WhatsApp messages were sent during these tests.

Keyword coverage and semantic experience alignment are distinct measurements. A keyword list alone must not be presented as substantive work experience. Current automated checks cannot guarantee that every model-produced statement is factually entailed by the input; human or independent semantic review remains necessary for that claim.
