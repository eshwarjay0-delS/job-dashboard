# Second-bot Kompas packs

Eight category leaves that had no pack yet. Written 27 Nov 2026 on `ops/second-bot-packs`. Not merged. Not deployed. Chief integrates later.

`docs/kompas-packs/` was empty on master. `ops/chief-packs` is not on origin. There was no earlier pack file to copy, so each pack uses the five sections from the task: must-mention, what to avoid, impact stories, probe questions, speakable answers (120–180 words, first person).

## Source

Only `src/lib/kompas-houston-resume.txt`, the eshwarjay05 Houston resume the Kompas honesty gate uses when no session resume is loaded. The gate's note says the full Fortinet docx is not in the repo. Saint Louis, jayeshwar44, eshwarjay06, jayeshwar24, and the files under `resumes/` were not used.

Every pack may use only these lines:

- Title: Fortinet AWS Cloud Networking Engineer.
- 9+ years designing, deploying, and migrating secure network infrastructures across multi-region AWS.
- Led end-to-end FortiGate-VM deployments.
- Active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway.
- Cisco FTD to Fortinet migrations across six AWS regions. Those migrations and the FortiGate-VM deployments are the part he can speak to.
- FortiManager and FortiAnalyzer supported those FortiGate-VM deployments.
- NERC CIP applied to the network change and the zero-downtime cutovers.
- The wider cutover beyond the FortiGate-VM clusters was a team effort.

The summary names no employer company, customer, date range, certification, ticket count, or outage. Stories stay inside that role and say so when a name is missing.

## Packs

| Leaf | Files | On this resume | Honest bridge |
| --- | --- | --- | --- |
| PeopleSoft | `peoplesoft.md`, `peoplesoft.pdf` | None of the product. | FortiGate-VM change path, HA cutovers, NERC CIP on the network change. Ramp on PeopleSoft with the people who already run it. |
| SailPoint | `sailpoint.md`, `sailpoint.pdf` | SailPoint is absent. CyberArk is absent too (honesty-gate deny list). | FortiGate-VM deployments are not a SailPoint role. Ramp on aggregation and access reviews with the identity team. |
| Okta | `okta.md`, `okta.pdf` | Absent. This summary is the profile the gate describes as lacking Okta. Other library resumes that mention Okta were not used. | AWS network path only. Do not add Okta to the six-region migration. Ramp with the identity team. |
| Entra | `entra.md`, `entra.pdf` | Microsoft Entra ID is absent. The cloud on the resume is AWS, not Azure. Active Directory is absent. | Do not translate FortiGate-VM into Entra or Defender. Ramp on the tenant and Conditional Access with the identity team. |
| CrowdStrike | `crowdstrike.md`, `crowdstrike.pdf` | Absent. A first-person "I used CrowdStrike" is on the honesty-gate deny list. | FortiAnalyzer supported the FortiGate-VM deployments. That is firewall support, not Falcon. Ramp on sensors and detections with the endpoint team. No invented incident. |
| Defender | `defender.md`, `defender.pdf` | Microsoft Defender is absent. Sentinel, Intune, and Secure Score are absent. | Same FortiAnalyzer limit as CrowdStrike. Do not answer Defender with a CrowdStrike story. Ramp with the endpoint team. |
| Offensive | `offensive.md`, `offensive.pdf` | No engagement, no Burp, no OSCP (OSCP is on the deny list). | The work is build and migration. Active/passive failover is a cutover check, not a pen test. No recorded failure and no exploit path. |
| IT / Sec+ | `it-sec-plus.md`, `it-sec-plus.pdf` | The role itself is the IT coverage: Fortinet AWS cloud networking, HA, six-region migration, NERC CIP on the network change. Security+ is not on the resume. No helpdesk queue. | Do not claim the cert, a ticket count, or a password reset. Do not split the nine-plus years into employers the summary does not name. |

## PDFs

`pandoc` is not installed. `groff -Tpdf` has no pdf device. PDFs were written with a local Python text renderer (Helvetica, no extra packages, nothing paid). They are the same words as the markdown.

## Blocker

The full Fortinet Houston docx is not in the repo. These packs cannot name employers, dates, customers, or tools beyond the summary above. A richer pack waits on that docx being added as the honesty-gate source, still eshwarjay05 only.
