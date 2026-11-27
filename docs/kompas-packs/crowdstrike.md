# Kompas interview pack: CrowdStrike

Tree: Endpoint branch, CrowdStrike leaf. Defender is the sibling leaf and is also absent.

Source: `src/lib/kompas-houston-resume.txt`, the eshwarjay05 Houston resume that Kompas's honesty gate uses when no session resume is loaded. The gate's note says the full Fortinet docx is not in this repo, so this pack uses only that summary. It does not use the Saint Louis profile, jayeshwar44, eshwarjay06, jayeshwar24, or any other file in `resumes/`.

Coverage: CrowdStrike is not on the Houston resume. The honesty gate denies a first-person "I used CrowdStrike". FortiAnalyzer supported the FortiGate-VM deployments. That is firewall logging and management support, not endpoint detection and response.

## 1. Must-mention

- Say in the first two sentences that he has not used CrowdStrike and has not run Falcon.
- If they hear "Analyzer" and try to treat it as EDR, correct it: FortiAnalyzer supported the FortiGate-VM deployments. He will not quote detections, a mean time, or a host he isolated.
- Ramp line, future tense only: he would learn the sensor, the detection queue, and containment with the endpoint team. He would not invent a malware incident to practice the story.

Resume facts he may use, and only these:

- Title on the summary: Fortinet AWS Cloud Networking Engineer.
- Nine-plus years designing, deploying, and migrating secure network infrastructures across multi-region AWS environments.
- He led the end-to-end FortiGate-VM deployments.
- Those deployments include active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway.
- Cisco FTD to Fortinet migrations across six AWS regions. The summary says those migrations, and the FortiGate-VM deployments, are the part he can speak to.
- FortiManager and FortiAnalyzer supported those FortiGate-VM deployments.
- NERC CIP applied to the network change and the zero-downtime cutovers.
- The wider cutover beyond the FortiGate-VM clusters was a team effort.
- The summary does not name an employer company, a customer, a date range, a certification, a ticket count, or an outage. Say that before filling any of them in.

## 2. What to avoid

- Do not say "I deployed CrowdStrike", "I tuned a Falcon policy", or "I isolated a host."
- Do not convert FortiAnalyzer into a SIEM story or an EDR story. Splunk and Sentinel are also absent.
- Do not give a mean-time-to-detect, a sensor count, or a malware family.

On every pack:

- Do not start with "Having nine years" or any "Having [N] years" opener.
- Do not say he personally led the wider cutover. That cutover was a team effort. His part is the FortiGate-VM clusters and the six-region Cisco FTD to Fortinet migration.
- Do not invent an outage, a Sev-1, data loss, or a failed cutover. The summary does not name one. Active/passive failover is a test condition on the HA clusters, not a production incident.
- Do not invent an employer, a customer, a region name, a date, a certification, or a metric. "Six AWS regions", "nine-plus years", and "zero-downtime" are the only scale lines on the summary.
- Do not use Saint Louis, jayeshwar44, eshwarjay06, jayeshwar24, Cigna, Citi, McKesson, Molina, or Valero.
- Do not claim Dragos, Qualys, Splunk, Burp, CyberArk, Industrial Defender, Sentinel, Wiz, Zscaler, Fortify, Snyk, or OSCP. None of those are on this resume. The honesty gate treats a first-person "I used" on that list as a false claim.
- Do not claim Security+, CISSP, AZ-500, PenTest+, CySA+, or any other certificate. None are on this summary.
- Do not describe visa, pay, location, or work authorization.

## 3. Impact stories

These are set inside the Fortinet AWS Cloud Networking Engineer role on the Houston summary. They are not new employers. Where the summary is silent, the story says so instead of filling the gap.

### Story 1. Daily progress on the FortiGate-VM clusters

In the Fortinet AWS Cloud Networking Engineer role, the daily progress I can stand behind is the FortiGate-VM work. I led those deployments end to end. The concrete piece is the clusters: active/active and active/passive HA, integrated with AWS Gateway Load Balancer and Transit Gateway. FortiManager and FortiAnalyzer supported those deployments, so the management and the logging I can talk about sit on that firewall path. The summary does not give a ticket count, a standup roster, or a clock time, so I will not invent a queue or a meeting that happened at 9. If someone asks what moved, I stay on whether the FortiGate-VM cluster and its HA were in shape for the change.

FortiAnalyzer in that day is support for the FortiGate-VM deployments. It is not a CrowdStrike console, and I will not narrate Falcon detections I did not work.

### Story 2. The meeting he can hold: the six-region migration

The meeting I can actually hold is a walkthrough of the Cisco FTD to Fortinet migrations across six AWS regions, together with the FortiGate-VM deployments. The summary says those two are the part I can speak to. I open with what I led, the FortiGate-VM deployments and the HA clusters on Gateway Load Balancer and Transit Gateway, and I say the wider cutover beyond those clusters was a team effort. I do not name attendees, a customer, or a region code, because the summary does not. If the room is a change review, I can say NERC CIP applied to the network change and the cutovers were zero-downtime. I cannot produce a calendar invite or a decision log that was never written down here.

If the meeting asks for the endpoint agent on those migrations, I say CrowdStrike is not on my resume. The walkthrough stays on FTD to Fortinet.

### Story 3. The control-owner conversation, without a customer name

The closest thing on this resume to a customer or control-owner interaction is the network change under NERC CIP, including the zero-downtime cutovers. I will not invent a utility name, a control owner's name, or a meeting where someone signed an evidence sheet. What I can say is that NERC CIP applied to that network change and to those cutovers, and that my part was the FortiGate-VM clusters, not the wider cutover. If a reviewer asks whether I can explain the firewall path, I explain the HA design and the six-region FTD-to-Fortinet migration. If they ask for a named account, I say that name is not on my resume and I will not make it up.

I will not recast the NERC CIP network change as an endpoint policy I enforced in Falcon.

### Story 4. What he does when they ask what went wrong

The summary does not name an outage, a failed cutover, or hours of downtime, so I will not tell one. The grounded situation is active/passive failover on the HA clusters during cutovers that were zero-downtime. I do not turn that test into a story about production breaking. If a check had failed, the method I will say out loud is to keep the old path up and write down what the test showed. I do not have such a failure written on this resume, so I will not claim one happened. The wider cutover stayed a team effort. I speak to the FortiGate-VM deployments and the six-region migration.

I will not use a firewall failover test as proof that I contained a host in CrowdStrike. The summary names no incident.

### Story 5. Bridge when they ask for a story this resume does not have

This is a ramp, not a past CrowdStrike project. If they ask for a detection story, I say I have not used CrowdStrike. What I would do is learn how that team deploys sensors and triages detections, while my own examples stay on FortiAnalyzer as support for the FortiGate-VM deployments, plus the HA cutovers. I would not invent malware, a host name, or a containment action.

## 4. Probe questions

A big true claim still draws a scope test. A claim this resume cannot support has to be declined.

### If he mentions FortiAnalyzer

That tool is on the summary, and it is the claim most likely to be inflated into EDR.

- Probe: "So FortiAnalyzer was your detection stack. What did you catch?"
- Follow-up: "How fast did you isolate?"
- Follow-up: "Was CrowdStrike feeding that, or was Falcon the console you lived in?"
- Safe shape: FortiAnalyzer supported the FortiGate-VM deployments. No catch, no isolate time, no Falcon. CrowdStrike is not on the resume.

### If he is pushed into CrowdStrike

- Probe: "Walk me through a Falcon detection you closed."
- Follow-up: "Which prevention policy did you change after it?"
- Follow-up: "Tell me about a host you network-contained during the cutover."
- Safe shape: he has not done that. No detection name, no policy, no host. Bridge to the firewall path, then the ramp.

## 5. Speakable answers

First person. 120 to 180 words. The bridge is in the answer, not after it.

### Answer A. Have you worked in CrowdStrike?

Spoken length: 168 words.

I have not used CrowdStrike, and I will not describe a Falcon detection, a prevention policy, or a host I contained. My resume is the Fortinet AWS Cloud Networking Engineer summary: nine-plus years designing, deploying, and migrating secure network infrastructure across multi-region AWS. I led the FortiGate-VM deployments, including active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway. The part I can walk is those deployments and the Cisco FTD to Fortinet migrations across six AWS regions. FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. That is support for the firewall path, not an endpoint detection stack, and I will not pretend it is CrowdStrike. NERC CIP applied to the network change and to the zero-downtime cutovers. The wider cutover beyond the FortiGate-VM clusters was a team effort. The summary names no incident and no malware. If the seat needs CrowdStrike, I would learn the sensor and the detection queue with the endpoint team, and I would not invent an incident to sound fluent.

### Answer B. FortiAnalyzer caught the endpoint threats during those cutovers, right?

Spoken length: 155 words.

No. I will not say FortiAnalyzer caught endpoint threats. The summary says FortiManager and FortiAnalyzer supported the FortiGate-VM deployments, and that is as far as I can take those two products. I led those deployments, with active/active and active/passive HA integrated with AWS Gateway Load Balancer and Transit Gateway. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. CrowdStrike is not on the resume, so Falcon was not the console I lived in, and I will not say it fed FortiAnalyzer. The cutovers I will describe were zero-downtime, and NERC CIP applied to the network change. The summary does not name a detection, a host, or an isolation, so I will not add them. The wider cutover was a team effort. If they want endpoint detection and response, I would ramp with the team that already runs it. I will not convert a firewall support tool into that story.

### Answer C. Tell me about a host you contained in the middle of a cutover.

Spoken length: 158 words.

I do not have a host containment to tell. CrowdStrike is not on my resume, and the summary does not name an incident, so I will not invent a machine I pulled off the network during a cutover. The cutover work I can talk about is the FortiGate-VM path. I led those deployments, including active/active and active/passive HA on AWS Gateway Load Balancer and Transit Gateway, and the cutovers were zero-downtime. NERC CIP applied to that network change. If a failover check had failed, I would keep the old path up and write down what the test showed. I have not recorded that failure here, and I will not replace it with a malware story. FortiManager and FortiAnalyzer supported the FortiGate-VM deployments. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. The wider cutover was a team effort. Containing a host in Falcon would be new work, learned with the endpoint team.
