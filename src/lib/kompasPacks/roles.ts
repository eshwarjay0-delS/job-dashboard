import type { KompasPack } from "./types.ts"

const empty = ""

export const ROLE_PACKS: KompasPack[] = [
  {
    id: "senior-cybersecurity-engineer",
    kind: "role",
    title: "Senior Cybersecurity Engineer",
    blurb: "The Citi role: operations, identity, detection, and the fix.",
    dossier: "This is the job I hold at Citi Bank in New York, from November 2024. I am the senior engineer across the work, not a single console. CyberArk and SailPoint for access, Splunk and Sentinel for detection, CrowdStrike and Defender on the host, Qualys and Nessus for the findings, Fortify on the application scan, Azure for the cloud control plane, and ServiceNow so the decision has an owner. The senior part is the judgment: which queue item is real, which team owns the fix, and what I verify before I close it. Earlier I did the same class of work at CVS, the City of San Diego, Charter, and Accenture. I answer from Citi when the question is about the current scope, and I name the earlier employer when the example lives there.",
    mustMention: ["Citi", "judgment", "ServiceNow", "detection", "owner"],
    avoid: ["A title with no employer", "Listing every tool and stopping", "A cloud network migration story", "Hedging the current role"],
    probes: [
      {
        question: "Tell me about yourself.",
        answer: "I am a Senior Cybersecurity Engineer at Citi Bank in New York. I run the operational security work: privileged access in CyberArk, identity in Entra ID and Active Directory, detection in Splunk and Sentinel, endpoints in CrowdStrike and Defender, vulnerabilities in Qualys and Nessus, and application findings in Fortify. Before Citi I was a Cybersecurity Engineer at CVS Health in Irving, a Digital Security Engineer for the City of San Diego, a Network Security Engineer at Charter in Stamford, and a Junior Cybersecurity Specialist at Accenture in India. I hold the CISSP and the Azure Security Engineer Associate. The through-line is the queue, the owner, and the check that the fix actually landed.",
      },
      {
        question: "What does senior mean in your current job?",
        answer: "At Citi it means I decide which evidence is enough to escalate and which team has to move. A Splunk alert with a matching CrowdStrike process is an incident ticket. A Qualys finding is a patch ticket with a hostname, not a slide. I write the ask in ServiceNow so the next person does not reinterpret my hunch. Senior is also when I tell an owner the exception has a date. I do not collect tools. I close the loop.",
      },
      {
        question: "Why should we believe you can operate without a runbook in front of you?",
        answer: "Because the path is the same one I have already run. At CVS I took a host from the Qualys finding through Tanium and ServiceNow until the rescan was clean. At Citi I take a privileged request from SailPoint into CyberArk and I confirm Entra ID matches. I can start from the account, the host, or the finding. I do not need the question to name the product before I know which record to open.",
      },
    ],
    checklist: [
      { item: "Current role", brief: "Citi, New York, November 2024 to present." },
      { item: "Judgment", brief: "Which evidence escalates, and which ticket it becomes." },
      { item: "Loop", brief: "ServiceNow owner plus a tool check before close." },
      { item: "Earlier work", brief: "Name CVS, San Diego, Charter, or Accenture only when the example is from there." },
      { item: "Certs", brief: "CISSP and Azure Security Engineer Associate, as context, not as the story." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "soc-analyst",
    kind: "role",
    title: "SOC Analyst",
    blurb: "The queue at Citi and CVS: detect, decide, hand off.",
    dossier: "A SOC analyst interview is the hour I spend in the queue. At Citi that queue is Splunk and Sentinel, with CrowdStrike and Defender on the host. At CVS it was the same pattern tracked in ServiceNow. I am not applying as someone who has only watched a dashboard. I triage, I write the ticket a responder can use, and I tune the detection that is paging on a pattern I can explain. The analyst answer is short on architecture and specific on the entity.",
    mustMention: ["queue", "Splunk", "host", "ServiceNow", "escalation"],
    avoid: ["Architect language about operating models", "An invented major incident", "Closing alerts with no entity", "Tool tourism"],
    probes: [
      {
        question: "Walk me through your last hour on shift.",
        answer: "At Citi I take the newest detection in Splunk or Sentinel and I read the account and the host before I read the rule description. I check CrowdStrike or Defender for that host. If the process is a known scanner in a change window, I note the window and I close it. If the account is moving in a way the last hour does not explain, I open ServiceNow with the query and I escalate. I do not clear the queue by closing the oldest ticket first. I clear the one that is still happening.",
      },
      {
        question: "What makes you escalate?",
        answer: "I escalate when the entity is real and I cannot explain it from the change record or the user's normal activity. A privileged account in CyberArk that just authenticated from a new host is an escalation at Citi. A laptop with a CrowdStrike detection and no matching benign process is an escalation. I put the limit of what I checked in the ticket. Escalation is not a way to get the alert off my screen. It is the point where someone else has to act.",
      },
      {
        question: "How do you document a false positive so it stays false?",
        answer: "I name the pattern, the owner of the system that causes it, and the exclusion. At CVS I wrote that in ServiceNow and I changed the Splunk search so the exclusion was visible in the detection, not only in my notes. The next week I looked at what the exclusion dropped. If a new host appeared inside it, I pulled the exclusion back. A false positive I cannot describe is an alert I should still be working.",
      },
    ],
    checklist: [
      { item: "Entity", brief: "Account and host before the rule essay." },
      { item: "Sensor", brief: "Splunk or Sentinel, then CrowdStrike or Defender." },
      { item: "Decision", brief: "Close with evidence, or escalate with the limit of the check." },
      { item: "Ticket", brief: "ServiceNow has the query." },
      { item: "Tune", brief: "A named exclusion, re-read." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "iam-engineer",
    kind: "role",
    title: "IAM Engineer",
    blurb: "CyberArk, SailPoint, Entra ID, and Okta as one path.",
    dossier: "An IAM engineer interview is the path from request to removal. At Citi I work CyberArk, SailPoint, Active Directory, Entra ID, and Okta as one system. SailPoint is the request and the certification. CyberArk is the privileged account. Entra ID and Active Directory are the directory. Okta is the sign-on policy for the federated apps. At CVS I administered the directory side of that work. I answer with the order of operations. I do not answer with a product diagram.",
    mustMention: ["SailPoint", "CyberArk", "Entra ID", "removal", "certification"],
    avoid: ["A product pitch", "Granting access in the vault before the approval", "Two sources of truth", "A breach story hung on a certification"],
    probes: [
      {
        question: "How do you build a joiner flow?",
        answer: "The person exists in Active Directory and Entra ID before any application role. At Citi the role request is a SailPoint request, approved by the owner of that role. Standard access follows the directory group. Privileged access is a separate SailPoint request that ends in a CyberArk account with rotation and a recorded session. Okta assignments follow the directory role for the apps that federate. I check the three systems the day after the start date. A joiner who can sign in and still has no manager-approved role is a broken flow, and I stop it.",
      },
      {
        question: "What do you do on a leaver the same day?",
        answer: "I disable the directory account in Active Directory and Entra ID, I disable the CyberArk accounts that directory user owns, and I remove the Okta assignments that would still let a session refresh. SailPoint should already have the leaver event. I do not wait for the next certification. At Citi I confirm there is no open PSM session. At CVS I did the directory disable the same day the ticket arrived. Same-day means the account cannot authenticate tonight.",
      },
      {
        question: "How do you design a certification that managers will actually finish?",
        answer: "I certify the roles that grant admin or production access, not every group in the directory. At Citi the SailPoint campaign is that set, and the line item shows the system and the last use I can pull. Managers revoke what they do not recognize. I then check CyberArk and Entra ID, because a completed campaign that leaves a standing admin group is not finished. The campaign is the question. The directory and the vault are the answer.",
      },
    ],
    checklist: [
      { item: "Order", brief: "Directory, then SailPoint approval, then vault or Okta." },
      { item: "Privilege", brief: "CyberArk only after the privileged role is approved." },
      { item: "Same day", brief: "Leaver disables directory, vault, and sign-on." },
      { item: "Campaign", brief: "High-risk roles, then a check of standing groups." },
      { item: "One source", brief: "Entra ID and Active Directory win an argument with a stale app." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "security-architect",
    kind: "role",
    title: "Security Architect",
    blurb: "How the controls connect, told from the systems I run.",
    dossier: "Security architect, in this interview, means I can say how the controls depend on each other. Identity grants the access. CyberArk holds privilege. Splunk and Sentinel see it. CrowdStrike and Defender contain the host. Qualys, Nessus, and Tanium prove the fix. Fortify gates the build. Azure is the subscription control plane. ServiceNow is the system of record. At Citi I work those connections. The architect answer is the dependency and the failure when one control is skipped. It is not a reference model drawn on a whiteboard with no system behind it.",
    mustMention: ["dependency", "identity", "detection", "record", "failure"],
    avoid: ["A framework poster", "A design that names tools I do not run", "AWS network architecture", "Depth with no failure mode"],
    probes: [
      {
        question: "How do you design the path from an identity change to a detection?",
        answer: "The change has to be visible. At Citi a role assignment in Entra ID and a privileged checkout in CyberArk are events I want in Sentinel and in Splunk. If the directory can change and the SIEM does not see it, the detection program is blind to the control that matters most. I draw that dependency before I draw a network zone. The failure mode is a standing admin role that never becomes an alert. I test the path by making a role change in a non-production tenant pattern and confirming the event arrives. If it does not arrive, the architecture is a diagram.",
      },
      {
        question: "Where do vulnerability findings sit in the design?",
        answer: "Qualys or Nessus produces the finding. Tanium confirms the host. ServiceNow holds the owner. The architecture fails when the scanner writes a report that never becomes a ticket, or when the ticket closes without a rescan. At CVS I treated that chain as the design. At Citi I keep the same chain. A dashboard of open findings is not a control. The control is the owner and the proof.",
      },
      {
        question: "What do you refuse to call an architecture?",
        answer: "A list of products the company owns. Architecture is which system is authoritative when two of them disagree. Entra ID over a stale Okta assignment. The host query over a stale Nessus finding. The ServiceNow record over a chat message. At Citi I will say that out loud in a design review. If the room cannot name the authoritative system, we do not have a design yet.",
      },
    ],
    checklist: [
      { item: "Authoritative system", brief: "Say which console wins a disagreement." },
      { item: "Identity to SIEM", brief: "Role change and vault checkout must be events." },
      { item: "Finding to ticket", brief: "Scanner, host check, ServiceNow owner." },
      { item: "Failure", brief: "Name what breaks when a step is skipped." },
      { item: "Test", brief: "One change you watched arrive in the detection." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "cloud-security-engineer",
    kind: "role",
    title: "Cloud Security Engineer",
    blurb: "Azure only: identity, Defender, Sentinel, and the subscription owner.",
    dossier: "This role is Azure security, which is the cloud I work and the associate certification I hold. At Citi I look at subscription ownership in Entra ID, Defender findings, and Sentinel for the control-plane events. Privileged cloud admin goes through the same CyberArk path as other admin. I do not take a question about another cloud's network fabric. If they ask for a migration across regions or a third-party firewall in the cloud, I bring the answer back to identity, logging, and who can change the subscription.",
    mustMention: ["Azure", "Entra ID", "Sentinel", "Defender", "subscription owner"],
    avoid: ["Any other cloud's network story", "A firewall vendor migration", "A certification with no subscription", "Inventing regions"],
    probes: [
      {
        question: "How do you approach a new Azure subscription?",
        answer: "I list the Entra ID roles that can change it and I remove standing privilege that has no break-glass reason. At Citi the admin path that remains goes through CyberArk. I turn on the logs that Sentinel needs for sign-in and role assignment, and I read the Defender recommendations that are open. The owner of the subscription is a name in ServiceNow, not a shared mailbox. I am done with the first pass when I can say who can change the subscription and where that change will show up.",
      },
      {
        question: "What do you monitor after the subscription is in use?",
        answer: "Role assignment, new public exposure, and a Defender alert on the resource. Those three go to Sentinel, and I correlate them with the Splunk detections if the identity also touched an on-premises host. At Citi a new owner on a subscription is a ticket even when nothing else fired. Public storage with no ticket is the item I will interrupt a meeting for. I do not watch every read. I watch the changes that grant power or expose data.",
      },
      {
        question: "How do you talk about the Azure certification in an interview?",
        answer: "I mention the Azure Security Engineer Associate once, then I talk about the subscription. The exam is not a story. The story is Entra ID, Defender, and Sentinel on the Citi work. If they want the control objective, I can say it in CISSP language and still point at the Azure resource. I do not spend the answer on the badge.",
      },
    ],
    checklist: [
      { item: "Who", brief: "Entra ID roles that can change the subscription." },
      { item: "Privilege", brief: "Standing admin off. CyberArk for the path that stays." },
      { item: "Signals", brief: "Role change, exposure, Defender alert, in Sentinel." },
      { item: "Owner", brief: "A person in ServiceNow." },
      { item: "Boundary", brief: "Azure. Stop if the question leaves Azure." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "security-director",
    kind: "role",
    title: "Security Director",
    blurb: "Risk, ownership, and the operational proof underneath.",
    dossier: "A director interview still has to be my work, told at the level of the decision and the residual risk. I am a senior engineer at Citi, not a director on the org chart. I answer as someone who has had to make the call and carry it to an owner: what we will fix now, what we will accept, and how we will know. The proof stays operational. ServiceNow holds the acceptance. Qualys, CyberArk, Sentinel, or CrowdStrike is how I know the acceptance is still true. I do not perform a strategy speech with no system under it. I do not close with a stock line about walking someone through a build.",
    mustMention: ["residual risk", "owner", "decision", "ServiceNow", "proof"],
    avoid: ["Strategy with no system", "Pretending I am already a director at Citi", "A stock closer", "A metric I did not measure"],
    probes: [
      {
        question: "How do you decide what the organization fixes first?",
        answer: "I put the items that expand who can change production, or what an outsider can reach, ahead of the noisy rest. At Citi that is a standing privileged role, a public Azure resource, or a Fortify finding on a build we are about to promote. The owner is named in ServiceNow with a date. Everything else is a queue with a team. I can defend that order because I can open CyberArk, Defender, or Fortify and show the item. I do not defend it with a heat map.",
      },
      {
        question: "How do you accept risk without losing the thread?",
        answer: "Acceptance is a named owner, a date, and a compensating control I can check. At CVS I accepted a delayed patch only with the account restriction written down and a Tanium check on the date. At Citi I do the same with Entra ID or CyberArk as the compensating control. When the date arrives I reopen the ticket. Residual risk that nobody rereads is just a gap we stopped mentioning.",
      },
      {
        question: "What do you tell a board-level person in two minutes?",
        answer: "I tell them which access can change the business, what we did about it this quarter, and what we are still carrying. At Citi that is privileged access in CyberArk, identity in Entra ID, and the findings that still have an owner in ServiceNow. I do not walk the tools. I name the decision and the proof. If they ask how I know, I can go to the record. I stop when the decision is clear.",
      },
    ],
    checklist: [
      { item: "Order", brief: "Power and exposure before noise." },
      { item: "Name", brief: "The owner is a person, in ServiceNow." },
      { item: "Acceptance", brief: "Date plus a control you can recheck." },
      { item: "Proof", brief: "One system you can open if they ask how you know." },
      { item: "Stop", brief: "End on the decision. No stock close." },
    ],
    notebookLmUrl: empty,
  },
]
