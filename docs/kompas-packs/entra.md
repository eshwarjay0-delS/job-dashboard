# Kompas interview pack: Entra

Tree: IAM branch, Entra leaf. This is Microsoft Entra ID. The resume's cloud is AWS, not Azure and not Entra.

Source: `src/lib/kompas-houston-resume.txt`, the eshwarjay05 Houston resume that Kompas's honesty gate uses when no session resume is loaded. The gate's note says the full Fortinet docx is not in this repo, so this pack uses only that summary. It does not use the Saint Louis profile, jayeshwar44, eshwarjay06, jayeshwar24, or any other file in `resumes/`.

Coverage: Microsoft Entra ID is not on the Houston resume. Do not claim Conditional Access, PIM, ID Protection, Entra Connect, or Azure AD as work he did.

## 1. Must-mention

- Say in the first two sentences that he has not used Microsoft Entra ID.
- The cloud he can discuss is AWS: multi-region network infrastructure, Gateway Load Balancer, Transit Gateway, FortiGate-VM. Do not translate that into Azure.
- Ramp line, future tense only: he would learn Entra tenants, Conditional Access, and directory roles with the identity team. He would not claim a sync from on-premises AD, because Active Directory is not on this resume either.

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

- Do not say "same thing as Azure AD, which I ran." He did not run it on this resume.
- Do not invent an Azure subscription, a tenant name, a Conditional Access gap, or a PIM activation.
- Do not answer an Entra question with Okta details. Okta is also absent. See `okta.md`.

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

That daily work is AWS and FortiGate-VM. Entra was not in it, and I will not rename the cloud to Azure to match the question.

### Story 2. The meeting he can hold: the six-region migration

The meeting I can actually hold is a walkthrough of the Cisco FTD to Fortinet migrations across six AWS regions, together with the FortiGate-VM deployments. The summary says those two are the part I can speak to. I open with what I led, the FortiGate-VM deployments and the HA clusters on Gateway Load Balancer and Transit Gateway, and I say the wider cutover beyond those clusters was a team effort. I do not name attendees, a customer, or a region code, because the summary does not. If the room is a change review, I can say NERC CIP applied to the network change and the cutovers were zero-downtime. I cannot produce a calendar invite or a decision log that was never written down here.

If the meeting assumes a Microsoft tenant, I say I have not worked in Entra. The walkthrough stays on the six-region FTD-to-Fortinet migration.

### Story 3. The control-owner conversation, without a customer name

The closest thing on this resume to a customer or control-owner interaction is the network change under NERC CIP, including the zero-downtime cutovers. I will not invent a utility name, a control owner's name, or a meeting where someone signed an evidence sheet. What I can say is that NERC CIP applied to that network change and to those cutovers, and that my part was the FortiGate-VM clusters, not the wider cutover. If a reviewer asks whether I can explain the firewall path, I explain the HA design and the six-region FTD-to-Fortinet migration. If they ask for a named account, I say that name is not on my resume and I will not make it up.

I will not recast NERC CIP on the network change as an Entra Conditional Access policy I wrote.

### Story 4. What he does when they ask what went wrong

The summary does not name an outage, a failed cutover, or hours of downtime, so I will not tell one. The grounded situation is active/passive failover on the HA clusters during cutovers that were zero-downtime. I do not turn that test into a story about production breaking. If a check had failed, the method I will say out loud is to keep the old path up and write down what the test showed. I do not have such a failure written on this resume, so I will not claim one happened. The wider cutover stayed a team effort. I speak to the FortiGate-VM deployments and the six-region migration.

I will not use a firewall failover test as proof that I failed over an Entra tenant.

### Story 5. Bridge when they ask for a story this resume does not have

This is a ramp, not a past Entra project. If they ask for an Entra story, I say I have not administered Entra ID. What I would do is learn that team's tenant and their Conditional Access with them, while my examples stay on the AWS path I led: FortiGate-VM, HA, Gateway Load Balancer, Transit Gateway, and the six-region migration. I would not invent Active Directory on either side of a sync.

## 4. Probe questions

A big true claim still draws a scope test. A claim this resume cannot support has to be declined.

### If he says he led the FortiGate-VM deployments on AWS

- Probe: "Talk me through the identity plane. Was that Entra?"
- Follow-up: "How did Conditional Access treat the admin path into those firewalls?"
- Follow-up: "Did you use PIM for the cutover accounts?"
- Safe shape: the identity plane is not on the resume. He led FortiGate-VM and HA on Gateway Load Balancer and Transit Gateway. He does not invent Entra in front of the management plane.

### If he is pushed into Entra

- Probe: "Walk me through a Conditional Access policy you shipped."
- Follow-up: "What broke in Entra Connect?"
- Follow-up: "How did you handle a risky sign-in?"
- Safe shape: none of that is on the resume. No policy name, no sync error, no risky-user count. Bridge to AWS network work, then the ramp.

## 5. Speakable answers

First person. 120 to 180 words. The bridge is in the answer, not after it.

### Answer A. Have you worked in Microsoft Entra?

Spoken length: 174 words.

I have not used Microsoft Entra ID, and I will not describe a tenant, a Conditional Access policy, or a PIM activation I did not run. My resume is the Fortinet AWS Cloud Networking Engineer summary: nine-plus years designing, deploying, and migrating secure network infrastructure across multi-region AWS. I led the FortiGate-VM deployments, including active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway. The part I can walk is those deployments and the Cisco FTD to Fortinet migrations across six AWS regions. FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. NERC CIP applied to the network change and to the zero-downtime cutovers. The wider cutover beyond the FortiGate-VM clusters was a team effort. This summary is AWS, not Azure, and it does not mention Active Directory, so I will not invent a directory sync to sound closer to Entra. If the seat needs Entra, I would learn the tenant and Conditional Access with the identity team, and I would keep my examples on the AWS network path I actually led.

### Answer B. The admin path into those firewalls was Entra, right?

Spoken length: 151 words.

I will not put Entra on the admin path. It is not on my resume. What I led was the FortiGate-VM deployments, with active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway. FortiManager and FortiAnalyzer supported those deployments, so the management and logging I can talk about are Fortinet tools on that firewall path, not a Microsoft directory. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. I cannot say how sign-in to the admin plane was governed, because the summary does not say. NERC CIP applied to the network change and the zero-downtime cutovers. The wider cutover was a team effort. The summary names no customer and no dates. Conditional Access and PIM would be a ramp for me with the team that already runs Entra, not a control I can claim I shipped in front of those clusters.

### Answer C. Tell me about a risky Entra sign-in you had to block.

Spoken length: 162 words.

I do not have a risky Entra sign-in to tell. Entra is not on my resume, so I will not invent a user, a risk score, or a block I clicked. The work I can talk about is the network change on AWS. I led the FortiGate-VM deployments and the HA clusters, and I can speak to the Cisco FTD to Fortinet migrations across six AWS regions. The cutovers I will describe are the zero-downtime ones, and NERC CIP applied to that network change. The summary does not name an outage or a compromised account, so I will not borrow an identity incident to create one. If a failover check had failed, I would keep the old path up and write down what the test showed. I have not recorded that failure here. The wider cutover was a team effort. FortiManager and FortiAnalyzer supported the FortiGate-VM deployments. Blocking a risky sign-in in Entra would be new work, learned with the identity team.
