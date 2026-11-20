# Adversarial clarifier run

Code under test: PR #467 head `f5df791c`, not this branch. The clarifier was not edited.

Command:

`REPO=/tmp/pr467 node --no-warnings --experimental-strip-types scripts/run-clarifier-adversarial.mjs`

Existing suite on that same head: `scripts/run-clarifier-fixtures.mjs` → **47/47**.

New file: `scripts/fixtures/clarifier-adversarial.json` (20 cases). Rule: a clarifier’s options come from the live question, or there is no clarifier. `must_not` is applied to the clarifier text. `.+` still means the whole box is empty. The say line may quote the resume.

**11 pass, 9 fail.**

| Category | Pass |
|---|---|
| vague_referent | 3/3 |
| candidate_speech | 1/1 |
| multi_part | 2/3 |
| interruption | 1/3 |
| trailing_right | 3/4 |
| overloaded_term | 0/2 |
| numbers_ask | 0/1 |
| hypothetical | 0/1 |
| behavioral | 0/1 |
| already_clear | 1/1 |

Fails (clarifier that was returned):

1. Phishing / tools / report → “the incident itself, then the tools”.
2. “Wait, forget the CMDB. How do you handle incidents?” → SOC vs ServiceNow.
3. “Actually, skip discovery. Did you design the import sets alone?” → “CI count, or the servers and users”.
4. “Did you design it alone, right?” after an SD-WAN turn → “overall SD-WAN design, or a specific piece like failover”.
5. “How do you handle incidents?” → SOC vs ServiceNow.
6. “How many tickets did you close in a day?” → “the whole team's queue”.
7. Suspicious email → “clicked the link”.
8. “Tell me about a time you led a team.” → “people lead” vs “technical work”.
9. “How do you manage access?” → “provisioning”.

The grounded pass is “Did you design the network alone? What about failover?” → “Should I answer the network design first, or the failover?”
