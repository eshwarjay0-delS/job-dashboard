# Kompas interview pack: Okta

Tree: IAM branch, Okta leaf.

Source: `src/lib/kompas-houston-resume.txt`, the eshwarjay05 Houston resume that Kompas's honesty gate uses when no session resume is loaded. The gate's note says the full Fortinet docx is not in this repo, so this pack uses only that summary. It does not use the Saint Louis profile, jayeshwar44, eshwarjay06, jayeshwar24, or any other file in `resumes/`.

Coverage: Okta is not on the Houston resume. The honesty-gate notes call this summary an older profile that lacks Okta. Other files in `resumes/` mention Okta and must not be used.

## 1. Must-mention

- Say in the first two sentences that he has not used Okta.
- Do not "remember" Okta from a GC Remote or Cyber Marketing resume. Those are not this source.
- The adjacent work is the AWS network path: FortiGate-VM, Gateway Load Balancer, Transit Gateway, six-region migration. He did not put an identity provider in that path on this resume. Do not add one.
- Ramp line, future tense only: he would learn Okta tenants, SSO, and MFA with the identity team. He would not claim a SAML app he integrated.

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

- Do not say he built an Okta integration, Universal Directory, Workflows, FastPass, or an Okta Identity Governance campaign.
- Do not say the six-region migration "used Okta for SSO" to make the story sound current.
- Do not claim a user count, an app count, or an MFA adoption percentage.

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

That daily work is the firewall cluster. Okta was not part of it on this resume, and I will not add it.

### Story 2. The meeting he can hold: the six-region migration

The meeting I can actually hold is a walkthrough of the Cisco FTD to Fortinet migrations across six AWS regions, together with the FortiGate-VM deployments. The summary says those two are the part I can speak to. I open with what I led, the FortiGate-VM deployments and the HA clusters on Gateway Load Balancer and Transit Gateway, and I say the wider cutover beyond those clusters was a team effort. I do not name attendees, a customer, or a region code, because the summary does not. If the room is a change review, I can say NERC CIP applied to the network change and the cutovers were zero-downtime. I cannot produce a calendar invite or a decision log that was never written down here.

If the meeting turns to SSO, I say I have not configured Okta. I keep the walkthrough on the FTD-to-Fortinet migration.

### Story 3. The control-owner conversation, without a customer name

The closest thing on this resume to a customer or control-owner interaction is the network change under NERC CIP, including the zero-downtime cutovers. I will not invent a utility name, a control owner's name, or a meeting where someone signed an evidence sheet. What I can say is that NERC CIP applied to that network change and to those cutovers, and that my part was the FortiGate-VM clusters, not the wider cutover. If a reviewer asks whether I can explain the firewall path, I explain the HA design and the six-region FTD-to-Fortinet migration. If they ask for a named account, I say that name is not on my resume and I will not make it up.

I will not recast the NERC CIP network change as an Okta policy or a sign-on rule I enforced.

### Story 4. What he does when they ask what went wrong

The summary does not name an outage, a failed cutover, or hours of downtime, so I will not tell one. The grounded situation is active/passive failover on the HA clusters during cutovers that were zero-downtime. I do not turn that test into a story about production breaking. If a check had failed, the method I will say out loud is to keep the old path up and write down what the test showed. I do not have such a failure written on this resume, so I will not claim one happened. The wider cutover stayed a team effort. I speak to the FortiGate-VM deployments and the six-region migration.

I will not use a failover test as proof that I failed over an Okta org.

### Story 5. Bridge when they ask for a story this resume does not have

This is a ramp, not a past Okta project. If they ask for an Okta story, I say I have not administered Okta. What I would do is learn that team's tenant, how they attach applications, and how they enforce MFA, while my own examples stay on FortiGate-VM, HA, and the six-region Cisco FTD migration. I would not invent an identity provider in a path the resume describes only as network infrastructure.

## 4. Probe questions

A big true claim still draws a scope test. A claim this resume cannot support has to be declined.

### If he says the six-region migration

"Six AWS regions" is on the summary. It draws a geography and an ownership test.

- Probe: "Name the regions, and tell me which one slipped."
- Follow-up: "Did every region use the same HA pattern?"
- Follow-up: "Where did Okta sit in that design?"
- Safe shape: six regions, Cisco FTD to Fortinet, no region names, no slip. HA was active/active and active/passive on the FortiGate-VM clusters with Gateway Load Balancer and Transit Gateway. Okta was not in the design on this resume.

### If he is pushed into Okta

- Probe: "Walk me through an Okta SAML app you integrated."
- Follow-up: "How did you handle a group push that over-granted?"
- Follow-up: "What did you do when MFA enrollment stalled?"
- Safe shape: he has not done that. No app name, no group, no enrollment rate. Bridge back to the network path, then the ramp.

## 5. Speakable answers

First person. 120 to 180 words. The bridge is in the answer, not after it.

### Answer A. Have you worked in Okta?

Spoken length: 167 words.

I have not used Okta, and I will not describe an Okta tenant I did not run. My resume is the Fortinet AWS Cloud Networking Engineer summary: nine-plus years designing, deploying, and migrating secure network infrastructure across multi-region AWS. I led the FortiGate-VM deployments, including active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway. The part I can walk is those deployments and the Cisco FTD to Fortinet migrations across six AWS regions. FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. NERC CIP applied to the network change and to the zero-downtime cutovers. The wider cutover beyond the FortiGate-VM clusters was a team effort. I will not pull Okta in from a different resume, and I will not say the migration used Okta for single sign-on, because this summary never says that. If the seat needs Okta, I would learn the tenant, the application attachments, and MFA with the identity team. I would keep my examples on the network path I actually led.

### Answer B. Which of the six regions was the hard one, and how did identity fit?

Spoken length: 156 words.

I can speak to the Cisco FTD to Fortinet migrations across six AWS regions, and to the FortiGate-VM deployments I led. I cannot name the regions, and I cannot pick one that slipped, because the summary does not. The HA on those deployments was active/active and active/passive, integrated with AWS Gateway Load Balancer and Transit Gateway. Identity does not fit as a tool I ran. Okta is not on this resume, so I will not place an Okta org in that design after the fact. FortiManager and FortiAnalyzer supported the FortiGate-VM deployments. NERC CIP applied to the network change and the zero-downtime cutovers. The wider cutover was a team effort, so I will not say I owned every layer in every region. The summary names no customer and no dates. If they need the identity layer, that is a ramp for me with the team that already runs it, not a layer I can claim today.

### Answer C. Tell me about an Okta change that locked people out.

Spoken length: 158 words.

I do not have an Okta lockout to tell. Okta is not on my resume, so I will not invent an application, a group rule, or a number of users who could not sign in. The change I can talk about is the network change. I led the FortiGate-VM deployments, with active/active and active/passive HA on Gateway Load Balancer and Transit Gateway, and the cutovers on that path were zero-downtime. The summary does not name an outage, so I will not borrow a lockout from Okta to create one. If a failover check had failed, I would keep the old path up and write down what the test showed. I have not recorded that failure here. NERC CIP applied to the network change. The wider cutover was a team effort. I can also speak to the Cisco FTD to Fortinet migrations across six AWS regions. An Okta policy change would be new work, learned with the identity team.
