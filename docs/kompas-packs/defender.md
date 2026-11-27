# Kompas interview pack: Defender

Tree: Endpoint branch, Defender leaf. This is Microsoft Defender. CrowdStrike is the sibling and is also absent. Sentinel is absent.

Source: `src/lib/kompas-houston-resume.txt`, the eshwarjay05 Houston resume that Kompas's honesty gate uses when no session resume is loaded. The gate's note says the full Fortinet docx is not in this repo, so this pack uses only that summary. It does not use the Saint Louis profile, jayeshwar44, eshwarjay06, jayeshwar24, or any other file in `resumes/`.

Coverage: Microsoft Defender is not on the Houston resume. Do not claim Defender for Endpoint, Defender for Cloud, Secure Score, Intune, or Sentinel as work he did.

## 1. Must-mention

- Say in the first two sentences that he has not used Microsoft Defender.
- The visibility tool he can name is FortiAnalyzer, and only as support for the FortiGate-VM deployments. It is not Defender and it is not Sentinel.
- The cloud on the resume is AWS, not Azure, so Defender for Cloud is not a translation of the FortiGate-VM work.
- Ramp line, future tense only: he would learn the Defender portal, alerts, and device response with the endpoint team.

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

- Do not say he lived in the Defender portal, closed an alert, raised Secure Score, or deployed Intune policy.
- Do not answer Defender with a CrowdStrike story. He has not used CrowdStrike either. See `crowdstrike.md`.
- Do not invent an alert count or a device count.

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

That daily logging is FortiAnalyzer supporting FortiGate-VM. It is not the Defender portal, and I will not narrate Defender alerts I did not triage.

### Story 2. The meeting he can hold: the six-region migration

The meeting I can actually hold is a walkthrough of the Cisco FTD to Fortinet migrations across six AWS regions, together with the FortiGate-VM deployments. The summary says those two are the part I can speak to. I open with what I led, the FortiGate-VM deployments and the HA clusters on Gateway Load Balancer and Transit Gateway, and I say the wider cutover beyond those clusters was a team effort. I do not name attendees, a customer, or a region code, because the summary does not. If the room is a change review, I can say NERC CIP applied to the network change and the cutovers were zero-downtime. I cannot produce a calendar invite or a decision log that was never written down here.

If the meeting assumes Microsoft endpoint protection on the migration, I say Defender is not on my resume. The walkthrough stays on FTD to Fortinet on AWS.

### Story 3. The control-owner conversation, without a customer name

The closest thing on this resume to a customer or control-owner interaction is the network change under NERC CIP, including the zero-downtime cutovers. I will not invent a utility name, a control owner's name, or a meeting where someone signed an evidence sheet. What I can say is that NERC CIP applied to that network change and to those cutovers, and that my part was the FortiGate-VM clusters, not the wider cutover. If a reviewer asks whether I can explain the firewall path, I explain the HA design and the six-region FTD-to-Fortinet migration. If they ask for a named account, I say that name is not on my resume and I will not make it up.

I will not recast NERC CIP on the network change as a Defender compliance policy or a Secure Score movement.

### Story 4. What he does when they ask what went wrong

The summary does not name an outage, a failed cutover, or hours of downtime, so I will not tell one. The grounded situation is active/passive failover on the HA clusters during cutovers that were zero-downtime. I do not turn that test into a story about production breaking. If a check had failed, the method I will say out loud is to keep the old path up and write down what the test showed. I do not have such a failure written on this resume, so I will not claim one happened. The wider cutover stayed a team effort. I speak to the FortiGate-VM deployments and the six-region migration.

I will not use a firewall failover test as proof that I isolated a device in Defender. The summary names no incident.

### Story 5. Bridge when they ask for a story this resume does not have

This is a ramp, not a past Defender project. If they ask for a Defender story, I say I have not used it. What I would do is learn how that team triages alerts and responds on a device, while my examples stay on FortiAnalyzer supporting the FortiGate-VM deployments and on the HA cutovers. I would not invent an alert, a device name, or a Secure Score.

## 4. Probe questions

A big true claim still draws a scope test. A claim this resume cannot support has to be declined.

### If he mentions FortiAnalyzer or the AWS deployments

- Probe: "Defender was on those instances, yes?"
- Follow-up: "What Secure Score gap did you close before the cutover?"
- Follow-up: "Show me an alert you dismissed as a false positive."
- Safe shape: Defender is not on the resume. FortiAnalyzer only supported the FortiGate-VM deployments. No Secure Score, no alert, no false-positive call.

### If he is pushed into Defender

- Probe: "Walk me through a Defender for Endpoint incident you led."
- Follow-up: "Did you use automatic investigation?"
- Follow-up: "How did Sentinel fit?"
- Safe shape: he has not done that. Sentinel is not on the resume either. Bridge to the firewall path, then the ramp.

## 5. Speakable answers

First person. 120 to 180 words. The bridge is in the answer, not after it.

### Answer A. Have you worked in Microsoft Defender?

Spoken length: 178 words.

I have not used Microsoft Defender, and I will not describe a Defender for Endpoint incident, a Secure Score change, or an Intune policy I shipped. My resume is the Fortinet AWS Cloud Networking Engineer summary: nine-plus years designing, deploying, and migrating secure network infrastructure across multi-region AWS. I led the FortiGate-VM deployments, including active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway. The part I can walk is those deployments and the Cisco FTD to Fortinet migrations across six AWS regions. FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. That support is on the firewall path. It is not Defender, and it is not Sentinel. NERC CIP applied to the network change and to the zero-downtime cutovers. The wider cutover beyond the FortiGate-VM clusters was a team effort. This summary is AWS, not Azure, so I will not translate the deployments into Defender for Cloud. If the seat needs Defender, I would learn the portal and the alert queue with the endpoint team, and I would not invent an incident to sound fluent.

### Answer B. Defender was covering those AWS instances during the cutover, right?

Spoken length: 154 words.

I will not say Defender covered those instances. It is not on my resume. What I led was the FortiGate-VM deployments, with active/active and active/passive HA integrated with AWS Gateway Load Balancer and Transit Gateway, and the cutovers on that path were zero-downtime. FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. I can speak to that support, and I cannot turn it into a Defender alert I closed or a Secure Score I moved. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. NERC CIP applied to the network change. The wider cutover was a team effort. The summary names no device, no alert, and no false positive, so I will not grade one. CrowdStrike is not on the resume either, so I will not swap in Falcon to answer a Defender question. If they need Microsoft endpoint protection, I would ramp with the team that already runs it.

### Answer C. Tell me about a Defender alert you had to overturn.

Spoken length: 165 words.

I do not have a Defender alert to overturn. Defender is not on my resume, so I will not invent an alert name, a device, or a false positive I sent back. The work I can talk about is the network change. I led the FortiGate-VM deployments and the HA clusters on Gateway Load Balancer and Transit Gateway. The cutovers were zero-downtime, and NERC CIP applied to that network change. The summary does not name an outage, so I will not use an alert story to create one. If a failover check had failed, I would keep the old path up and write down what the test showed. I have not recorded that failure here. FortiManager and FortiAnalyzer supported the FortiGate-VM deployments, which is the visibility I can actually describe. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. The wider cutover was a team effort. Overturning a Defender alert would be new work, learned with the endpoint team.
