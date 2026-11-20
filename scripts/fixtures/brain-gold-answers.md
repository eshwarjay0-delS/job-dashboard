# Brain gold answers: Kompas live test run 2 (10 questions)

Compiled Thu Nov 19, 2026, about 8:45 PM CT, by Brain's executor. Nothing here was pushed or committed. PR #460 has not been touched.

**What these are:** the answers Kompas *should* have produced for the 10 questions in `/workspace/kompas-live-test/run2.md` (Live interview, Senior SOC Analyst, Technical, Architect + Developer, Long). Use them as eval targets for the answer engine.

**Grounding source, the only one used:** `/workspace/lens-fp/resumes/GC Remote/Service Now/Eshwar_Resume.docx`, extracted with python-docx. It's the **eshwarjay05 (Houston) profile** (`eshwarjay05@gmail.com`, Mckesson – TX). Nothing from the Saint Louis / jayeshwar44 profile was used.

**About the "SOC job description in that same file":** the .docx holds **only the resume**. I searched its document.xml for "SOC", "SIEM", "job description" and "analyst" and found no JD. The session JD is known only second-hand: `muse-log-source.md` L1197 says it lists *Splunk ES, CrowdStrike Falcon, Defender, Qualys, ServiceNow, NIST CSF*. **None of those tools appear in the resume** apart from ServiceNow. So no answer claims experience with them. Where a question names one (Qualys), the answer says he hasn't used it and labels the method "I would".

**Rules applied:**
- Sentence one answers the question (or names the honesty gap in one clause, then moves on). After that comes what he did and why, then the result, then a short close.
- Lengths follow `perspectives.md` bands: lived stories 80–160, how-tos 60–200, short facts and comparisons 25–80, intros 60–120.
- Every employer, tool and number is in the resume. **The resume has almost no metrics.** Its only numbers are "10+ years", employment dates and ServiceNow release years. So "a real resume number" in the result beat is "10+ years" or a date where it fits naturally. Where no number fits, none was forced. Numbers that come from the question itself ("200 endpoints", "L1/L2/L3") are marked.
- Grounding lines are quoted verbatim from the resume. A script confirmed that every quoted line is an exact substring of the extracted resume, and that every digit in an answer appears in the resume or in the question.
- Word counts use the regex `[A-Za-z0-9][A-Za-z0-9'’+-]*`, so contractions and "10+" count as one word each.

## Summary

| Q | Question | Type | Words | Band | Flag |
|---|---|---|---:|---|---|
| a | Tell me about a time you led the response to a critical security incident. | Lived story (honesty gap + labelled 'I would') | 125 | 80-160 | **FLAGGED** |
| b | How would you investigate a phishing email reported by an employee? | How-to (labelled 'I would' process; real platform experience as support) | 152 | 60-200 | n/a |
| c | Explain the difference between EDR and SIEM, and when you would use each. | Comparison / short fact | 77 | 25-80 | n/a |
| d | Walk me through how you would contain a ransomware outbreak across 200 endpoints. | How-to / scenario (labelled 'I would') | 155 | 60-200 | **FLAGGED** |
| e | How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical? | How-to (labelled 'I would') | 148 | 60-200 | **FLAGGED** |
| f | Tell me about yourself. | Intro | 97 | 60-120 | n/a |
| g | Why did you choose cybersecurity? | Motivation (short personal) | 112 | 60-120 | **FLAGGED** |
| h | What are the roles of L1, L2 and L3 in a SOC? | Short fact / definition | 68 | 25-80 | n/a |
| i | What reports do you prepare as a SOC analyst? | Experience + labelled 'I would' (how-to band) | 114 | 60-200 | **FLAGGED** |
| j | What do you know about routing? | Definition / short fact | 76 | 25-80 | n/a |

## a. Tell me about a time you led the response to a critical security incident.
**Type:** Lived story (honesty gap + labelled 'I would') · **Words:** 125 (band 80-160)
**Note:** FLAGGED: the resume shows no security-incident leadership and no SOC role. 'Led' isn't supported. The answer says so and stays with what he 'assists' with.

> Honestly, I haven't been the lead on a SOC incident, so I won't dress it up. The closest I've come is on the platform side at McKesson, where I assist with ServiceNow platform incident resolution. When something breaks, I track it from creation to closure and keep the business updated as it moves, because people need to know what's affected before they hear the fix. I've also built the workflows investigators lean on, fraud investigation with evidence management, escalation handling and audit documentation. So if I were leading a critical security incident, I would confirm the alert is real first, contain it, and then keep stakeholders on a steady update rhythm. That's what 10+ years of building ServiceNow ITSM, incident process included, has taught me.

**Grounding (verbatim resume lines):**
- "Client: Mckesson - TX Sept 2023 - Present Role: Senior ServiceNow Developer"
- "Assists with ServiceNow platform incident resolution."
- "Tracking of Incidents from creation to closure, with timely communication to business. Monitoring service level agreements (SLAs) and operation level agreements (OLAs)."
- "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation."
- "Having 10+ years of experience in Sr. ServiceNow Development and Administration and implementation of various ServiceNow ITSM Modules."

## b. How would you investigate a phishing email reported by an employee?
**Type:** How-to (labelled 'I would' process; real platform experience as support) · **Words:** 152 (band 60-200)
**Note:** No phishing or email-security tool is in the resume, so the answer names none (no sandbox, Defender or Splunk). No resume number fits a process answer, and none was forced.

> I'd start by treating the report as an incident, not just an email, so it's logged and tracked from creation to closure. First I'd look at what the employee actually received: the sender, the headers, and any links or attachments, without clicking anything. Once I'm confident it's malicious, I'd check who else got it and whether this employee clicked or typed in a password. If they did, I'd go to Active Directory, check that account and its access, and get it locked down or reset. Then I'd pull the message from the other mailboxes, write the indicators into the ticket, and update a knowledge article so the service desk handles the next one faster. I've built ServiceNow automation for Active Directory and Exchange Server, so I know how to make those steps repeatable instead of manual. And I'd close the loop with the employee, because reporting it was exactly the right call.

**Grounding (verbatim resume lines):**
- "Tracking of Incidents from creation to closure, with timely communication to business."
- "Resolving typical User access and role issues by checking the active directory and users’ table."
- "Worked on service catalog and automation for Active Directory and Exchange Server using orchestration workflows."
- "Experience in working on the ITIL Process Configuration like Change Management and Knowledge Management and Reporting in ServiceNow."

## c. Explain the difference between EDR and SIEM, and when you would use each.
**Type:** Comparison / short fact · **Words:** 77 (band 25-80)
**Note:** Conceptual. No experience is claimed, because the resume has no EDR or SIEM product.

> EDR watches the endpoint itself, the processes, files and behavior on each laptop or server, and it can isolate that one machine on the spot. A SIEM pulls in logs from across the environment, firewalls, identity, servers and applications, and correlates them so you see the bigger pattern. I'd reach for EDR when I need to contain a specific host fast, and for the SIEM when I'm working out scope, hunting across systems, or building compliance reporting.

**Grounding (verbatim resume lines):**
- (none: definition only, no resume claim made)

## d. Walk me through how you would contain a ransomware outbreak across 200 endpoints.
**Type:** How-to / scenario (labelled 'I would') · **Words:** 155 (band 60-200)
**Note:** FLAGGED as 'I would': no ransomware or endpoint-containment experience in the resume. '200' comes from the question, not the resume.

> I'd contain first and investigate second, because ransomware spreads faster than anyone can analyze it. My first move would be cutting those 200 endpoints off the network, isolating them or their segment, and disabling any accounts that look compromised in Active Directory so it can't move laterally. Once the spread has stopped, I'd use the CMDB to see which machines support critical business services, because that tells me what to restore first and who to call. I'd run it as a major incident with emergency changes for the network and account actions, so every step is approved and auditable. Then recovery: rebuild from clean images and backups rather than trusting cleaned machines, reconnect in priority order, and open a problem record to find the entry point. I haven't run a ransomware response myself, so that's how I would approach it, but the CMDB and Change Management behind it are things I've implemented end to end.

**Grounding (verbatim resume lines):**
- "Expertise in Remedy Force, CMDB, and Change Management end-to-end implementation."
- "Configuration Management: setting up Configuration Management from scratch defining the CI classes and their relationships."
- "Applications and external databases. Implementing ServiceNow Discovery and CMDB and integrating with Change management"
- "Resolving typical User access and role issues by checking the active directory and users’ table."

## e. How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?
**Type:** How-to (labelled 'I would') · **Words:** 148 (band 60-200)
**Note:** FLAGGED: Qualys is in the session JD, not in the resume. The answer says he hasn't run it and labels the method 'I would'.

> When everything says critical, I stop trusting the label and rank by what the asset actually does for the business. I'll be upfront that I haven't run Qualys myself, but the approach I would take starts with the CMDB: match each finding to its CI, then ask whether it's internet-facing, whether it holds customer or financial data, and whether there's a known exploit out there. Those few questions usually split a wall of criticals into a short list that can't wait and a longer list that can follow normal patch cycles. I'd push the urgent ones through change management with owners and due dates, so nothing sits unassigned. On the ServiceNow side, I've configured predictive intelligence to search for potential vulnerabilities for SecOps, and I provided a Risk and Compliance overview dashboard across our business applications, so turning that ranking into something leadership can track is familiar ground.

**Grounding (verbatim resume lines):**
- "Configured machine learning and predictive intelligence to search for potential vulnerabilities (VR) using keywords descriptive by SecOps implementations."
- "Provided detailed report of Risk and Compliance overview dashboard of all Business Applications in our organization."
- "Supported asset lifecycle tracking and CMDB data management to improve visibility of enterprise assets and configurations."
- "Client: Qualcomm, Bangalore, India Sept 2015 - Aug 2018"

## f. Tell me about yourself.
**Type:** Intro · **Words:** 97 (band 60-120)

> I'm a Senior ServiceNow Developer with 10+ years on the platform, and I've been at McKesson since Sept 2023. A lot of my recent work sits close to risk: fraud investigation and AML workflows, KYC verification, and role-based access with segregation of duties for regulatory compliance. Before that I was at Molina Health Care, where I also supported GRC and Security Operations-related processes, and earlier at Valero Energy and Qualcomm. What ties it together is incident and change discipline, building processes people can trust and audit. That's what I want to bring to a security operations team.

**Grounding (verbatim resume lines):**
- "Having 10+ years of experience in Sr. ServiceNow Development and Administration and implementation of various ServiceNow ITSM Modules."
- "Client: Mckesson - TX Sept 2023 - Present Role: Senior ServiceNow Developer"
- "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation."
- "Automated AML and regulatory compliance workflows supporting customer risk profiling, sanctions screening, compliance reviews, exception handling, and governance controls."
- "Developed KYC (Know Your Customer) workflows to automate customer verification, compliance reviews, risk assessments, and approval processes."
- "Implemented role-based access controls, approval workflows, and segregation of duties controls supporting financial regulatory and operational compliance requirements."
- "Client: Molina Health Care – Long Beach, CA Dec 2022 - Jul 2023 Role: ServiceNow Developer/Administrator"
- "Configuration of service portals and configuration and support of GRC and Security Operations-related processes."
- "Client: Valero Energy, Texas Nov 2018 to Oct 2022 Role: ServiceNow Developer/Analyst"
- "Client: Qualcomm, Bangalore, India Sept 2015 - Aug 2018"

## g. Why did you choose cybersecurity?
**Type:** Motivation (short personal) · **Words:** 112 (band 60-120)
**Note:** FLAGGED: the resume states no personal motivation. The 'it grew out of the work' framing is inferred from the resume's risk and security lines. Eshwar should confirm it or swap in his real reason.

> Honestly, I didn't come to security from the outside; it grew out of the work I was already doing. The projects that pulled me in most were the risk-facing ones: fraud investigation workflows with evidence management and audit documentation, AML and sanctions screening, and role-based access with segregation of duties. Back at Molina Health Care I also supported GRC and Security Operations-related processes. Every time, the part I cared about was the same, catching the problem early and being able to prove what happened afterward. A SOC is where that gets answered every day, so it feels like the natural next step after 10+ years building the platforms security teams rely on.

**Grounding (verbatim resume lines):**
- "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation."
- "Automated AML and regulatory compliance workflows supporting customer risk profiling, sanctions screening, compliance reviews, exception handling, and governance controls."
- "Implemented role-based access controls, approval workflows, and segregation of duties controls supporting financial regulatory and operational compliance requirements."
- "Configuration of service portals and configuration and support of GRC and Security Operations-related processes."
- "Having 10+ years of experience in Sr. ServiceNow Development and Administration and implementation of various ServiceNow ITSM Modules."

## h. What are the roles of L1, L2 and L3 in a SOC?
**Type:** Short fact / definition · **Words:** 68 (band 25-80)
**Note:** Conceptual. L1, L2 and L3 come from the question. The only experience tie is escalation workflows, which the resume supports.

> L1 is the front line: they watch the alert queue, sort what's real from noise, and escalate anything they can't close. L2 takes those escalations and digs deeper into scope and root cause, and drives containment. L3 handles the hardest cases, threat hunting, advanced forensics, and tuning detections so the tiers below get better alerts. It's the same tiered escalation idea I've built into investigation workflows in ServiceNow.

**Grounding (verbatim resume lines):**
- "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation."
- "Developed customer-facing workflows using ServiceNow CSM modules including case management, customer communications, escalation handling, and service request automation."

## i. What reports do you prepare as a SOC analyst?
**Type:** Experience + labelled 'I would' (how-to band) · **Words:** 114 (band 60-200)
**Note:** FLAGGED: he hasn't been a SOC analyst. The SOC report list is labelled 'I'd expect'. The real reporting experience is quoted from the resume.

> I haven't sat in a SOC seat yet, so I'll answer with what I'd expect to prepare there and what I've already built. In a SOC I'd expect a shift handover summary, incident reports covering what happened, what we did and what's still open, and trend reporting on alert volume, response times and SLA adherence for leadership. Reporting itself is something I've done a lot of. I've created dashboards and operational analytics tracking compliance status, dispute resolution metrics and SLA adherence, and I provided a Risk and Compliance overview dashboard of all the business applications in our organization. So the format and the audience feel familiar; the security content is where I'd plug in.

**Grounding (verbatim resume lines):**
- "Created dashboards, reports, and operational analytics to track customer service performance, lending activities, dispute resolution metrics, compliance status, and SLA adherence."
- "Provided detailed report of Risk and Compliance overview dashboard of all Business Applications in our organization."
- "Tracking of Incidents from creation to closure, with timely communication to business. Monitoring service level agreements (SLAs) and operation level agreements (OLAs)."

## j. What do you know about routing?
**Type:** Definition / short fact · **Words:** 76 (band 25-80)
**Note:** Conceptual. Networking and routing aren't in the resume, so no experience is claimed.

> Routing is how a packet finds its way from one network to another. Each router looks at the destination IP address, checks its routing table, and forwards the packet to the best next hop, and that repeats until it arrives. Routes can be set by hand as static routes or learned automatically through routing protocols. In security it matters because routing decides which paths traffic can take, and that's where segmentation and firewall rules come in.

**Grounding (verbatim resume lines):**
- (none: definition only, no resume claim made)

## Why these beat the run 2 output (for the eval)

- **a:** Run 2 gave a 6-word stub ("I would want to confirm that."). Gold gives an honest gap plus a real adjacent story plus a labelled plan. That's the "say the gap in one clause, then the real thing" pattern from perspectives.md §Honesty-gap.
- **b, e, i:** Run 2 bolted generic ServiceNow ITIL lines onto SOC answers (and i went off-topic). Gold answers the SOC question first, then brings in ServiceNow only where the resume line actually supports it.
- **d:** Run 2 used "we" and a bare five-step list (85 words). Gold opens on the principle (contain first), connects steps by cause ("Once the spread has stopped…"), and labels it hypothetical.
- **f:** Run 2 gave one 25-word sentence that wasn't an intro. Gold gives a 97-word spoken intro with current role, the risk-facing work, earlier employers and a bridge to SOC.
- **g:** Run 2 had no personal reason. Gold's reason is inferred from the resume and **flagged for Eshwar to confirm**.
- **c, h, j:** Run 2 was mostly right. Gold keeps them in the 25–80 band, adds "when to use each" (c), and ties h to escalation work the resume supports. Gold avoids digit-dropping ("At L", "layer‑ switches") by not depending on stray digits.

## Flagged questions (cannot be fully answered from the resume)

- **a**: he resume shows no security-incident leadership and no SOC role. 'Led' isn't supported. The answer says so and stays with what he 'assists' with.
- **d**:  'I would': no ransomware or endpoint-containment experience in the resume. '200' comes from the question, not the resume.
- **e**: ualys is in the session JD, not in the resume. The answer says he hasn't run it and labels the method 'I would'.
- **g**: he resume states no personal motivation. The 'it grew out of the work' framing is inferred from the resume's risk and security lines. Eshwar should confirm it or swap in his real reason.
- **i**: e hasn't been a SOC analyst. The SOC report list is labelled 'I'd expect'. The real reporting experience is quoted from the resume.
