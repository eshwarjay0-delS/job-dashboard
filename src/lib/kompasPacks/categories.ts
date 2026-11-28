import type { KompasPack } from "./types.ts"

const empty = ""

export const CATEGORY_PACKS: KompasPack[] = [
  {
    id: "iam",
    kind: "category",
    title: "IAM (PAM/CyberArk, SailPoint, Okta, Entra ID)",
    blurb: "Privileged access, workforce identity, and joiner-mover-leaver.",
    dossier: "Identity work here is three controls that have to agree. CyberArk holds the privileged accounts and the session recording. SailPoint is the request, the approval, and the certification of who should keep access. Okta and Entra ID are the sign-on path: Entra ID is the workforce directory I administer with Active Directory, and Okta is the policy in front of the apps that federate. At Citi I run that set for the bank. At CVS I administered Active Directory and Entra ID beside the operations queue. A good answer names the population, the control that grants or removes access, and what I check when the request and the directory disagree. I do not describe a product demo. I describe the path a joiner, a mover, and a leaver actually take.",
    mustMention: ["CyberArk", "SailPoint", "Entra ID", "joiner mover leaver", "privileged account"],
    avoid: ["A vendor brochure with no population", "Claiming a breach from a certification campaign", "Mixing this with firewall cutovers", "Saying the directory and the vault are the same system"],
    probes: [
      {
        question: "Walk me through how you handle a privileged account from request to removal.",
        answer: "At Citi the request lands in SailPoint, not in the vault. The manager approves the role, and CyberArk is where the account actually lives. I check that the safe, the platform, and the dual control match the role that was approved. Onboarding is a password rotation and a PSM session, not a shared admin password in a ticket. When the person moves or leaves, SailPoint closes the assignment and I confirm the CyberArk account is disabled and the pending session is gone. Entra ID and Active Directory still have to match, because a vault account that points at a disabled directory user is a false sense of control. I reconcile those three before I call the access removed.",
      },
      {
        question: "How do you use Okta and Entra ID together?",
        answer: "Entra ID is the workforce directory I administer with Active Directory. Group membership there is what the apps and the conditional access policy read. Okta is the sign-on policy for the applications that federate through it. I keep the joiner in Entra ID first, then I confirm the Okta assignment follows the same role. If Okta shows access and Entra ID does not, I treat Okta as stale and I remove it. At CVS I did the same directory work in Entra ID for operations staff. I do not run two sources of truth. The directory is the source. Okta enforces the sign-on.",
      },
      {
        question: "Tell me about an access review you ran.",
        answer: "At Citi the certification is a SailPoint campaign against privileged and high-risk roles, not a spreadsheet of every group. I pull the campaign, I sit with the manager who owns the role, and I revoke what they cannot explain. CyberArk is the check after the click: the account should be disabled, not merely uncertified. I also look at Entra ID for the standing groups that the campaign does not see. A clean certification with a live standing admin group is not a clean review. I close the campaign only after those leftovers are gone.",
      },
    ],
    checklist: [
      { item: "Request path", brief: "SailPoint approval before any vault or directory change." },
      { item: "Vault", brief: "CyberArk safe, rotation, and recorded session. No shared password." },
      { item: "Directory", brief: "Active Directory and Entra ID agree with the role." },
      { item: "Sign-on", brief: "Okta policy follows the directory. Stale app access comes off." },
      { item: "Leaver", brief: "Assignment, vault account, and session all closed." },
      { item: "Review", brief: "Certification plus a check for standing admin groups." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "soc",
    kind: "category",
    title: "SOC",
    blurb: "Queue, detection, and the handoff out of the SOC.",
    dossier: "SOC work is the queue and the decision to escalate. At Citi I live in Splunk and Microsoft Sentinel for detection, with CrowdStrike and Defender feeding the endpoint side. At CVS the same tools sat next to a ServiceNow queue. A useful answer names the detection, the evidence I opened, the decision I made, and who received the ticket. I do not narrate a dashboard. I say what the alert was, what I checked first, and what I handed to incident response or to the system owner when it was real.",
    mustMention: ["Splunk", "Sentinel", "ServiceNow", "triage", "escalation"],
    avoid: ["Reading a list of SIEM features", "Closing an alert with no evidence named", "Inventing a Sev-1", "Handing every alert to the same team"],
    probes: [
      {
        question: "How do you triage an alert that just fired?",
        answer: "I open the detection in Splunk or Sentinel and I read the entity first: the account, the host, and the time. At Citi I check whether CrowdStrike or Defender already has the same host, because a SIEM alert with no endpoint corroboration is a different decision than one that matches. I look at the prior hour for that account, not the whole enterprise. If the activity matches a change window or a known scanner, I document that and I close it with the evidence. If it does not, I open the ServiceNow ticket with the query, the host, and the ask, and I escalate. I do not sit on a ticket because the queue is long.",
      },
      {
        question: "What do you put in the handoff to incident response?",
        answer: "The handoff is the question I cannot answer from the alert alone. At CVS I wrote the ServiceNow ticket with the detection name, the host, the account, the time, and the query I already ran in Splunk. I say what I ruled out. I do not paste the raw log and call it an analysis. Incident response needs the scope I already know and the scope I do not. If Defender or CrowdStrike has a prevention event, that goes in the ticket. If it does not, I say that too.",
      },
      {
        question: "How do you keep a noisy detection from burying a real one?",
        answer: "I tune the detection that pages the queue, not the one that is merely ugly. At Citi I take the Splunk or Sentinel search that fires on a known benign pattern, I add the exclusion with the owner of that system named in the change, and I leave the original logic in place for everything else. I do not suppress a detection because the count is high. I suppress the pattern I can explain. The next week I check that the exclusion did not swallow a new host. A tuned rule I never re-read is how a real alert disappears.",
      },
    ],
    checklist: [
      { item: "Entity", brief: "Account, host, and time before any theory." },
      { item: "Corroboration", brief: "SIEM plus CrowdStrike or Defender on the same host." },
      { item: "Benign path", brief: "Change window or known scanner, written down." },
      { item: "Ticket", brief: "ServiceNow gets the query and the ask, not a raw dump." },
      { item: "Tune", brief: "Exclude a known pattern. Do not mute the rule." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "incident-response",
    kind: "category",
    title: "Incident Response",
    blurb: "Scope, contain, and record the decision.",
    dossier: "Incident response starts when triage says the activity is not benign. At CVS I tracked that work in ServiceNow and used CrowdStrike and Defender to contain a host. At Citi I use the same endpoint tools plus Splunk and Sentinel to see how far the account moved. The answer is the scope I established, the containment I chose, and the record I left. I do not invent an outage or a data-loss event. I describe how I decide scope and how I keep the business owner in the ticket.",
    mustMention: ["scope", "containment", "CrowdStrike", "ServiceNow", "account"],
    avoid: ["A movie incident with a countdown", "Naming data loss that is not in the record", "Skipping the business owner", "Containing a whole site because one host looked odd"],
    probes: [
      {
        question: "How do you scope an incident once you believe it is real?",
        answer: "I start from the host and the account that triage already named. At Citi I search Splunk and Sentinel for that account across the same day, and I check CrowdStrike and Defender for other hosts that account touched. Scope is the set of hosts and the set of accounts I can tie to the same activity. I write that set in the ServiceNow ticket before I contain anything else. If a second account appears, it joins the scope. If it does not appear in the logs, I do not add it because it feels related.",
      },
      {
        question: "When do you isolate a host?",
        answer: "I isolate in CrowdStrike or Defender when the host is still executing the activity I am investigating, or when I cannot trust the process list. At CVS that was the containment step I recorded in ServiceNow, with the hostname and the reason. I do not isolate a file server because a laptop in the same building had an alert. Isolation is for the host in scope. I tell the owner in the ticket what the user will lose, and I lift the isolation when the image or the process evidence is captured and the account is disabled.",
      },
      {
        question: "What belongs in the incident record?",
        answer: "The record is the decision, not a transcript of the bridge. I write the detection, the scope, the containment, and who accepted the residual risk if we left a system up. At CVS that lived in ServiceNow so the next shift did not restart the work. I include the query and the endpoint action. I leave out speculation about motive. If I was wrong about scope, I correct the ticket. The record is what a later reviewer should be able to defend.",
      },
    ],
    checklist: [
      { item: "Start set", brief: "The host and account triage already proved." },
      { item: "Spread", brief: "Same account in Splunk or Sentinel, same day." },
      { item: "Contain", brief: "Isolate the host in scope in CrowdStrike or Defender." },
      { item: "Owner", brief: "The business owner sees the impact in the ticket." },
      { item: "Record", brief: "ServiceNow has the decision and the evidence path." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "endpoint",
    kind: "category",
    title: "Endpoint (CrowdStrike, Defender)",
    blurb: "Prevention, detection, and what the sensor actually saw.",
    dossier: "Endpoint is the sensor on the host, not a second SIEM. I use CrowdStrike and Microsoft Defender. At Citi and at CVS those consoles are where I confirm a process, a prevention, or a containment. Defender also ties to the Azure and Entra identity of the device. A straight answer names the prevention or detection policy, what I did on the host, and how I checked that the action held. I do not claim a product prevented something I did not look up.",
    mustMention: ["CrowdStrike", "Defender", "host", "prevention", "containment"],
    avoid: ["Feature lists with no host", "Saying the SIEM is the endpoint tool", "Isolating by habit", "A metric that is not in the work"],
    probes: [
      {
        question: "How do you investigate a host in CrowdStrike?",
        answer: "I open the host, not the detection feed. At Citi I read the process tree for the time in the alert, then the network and the file the process touched. If prevention fired, I say what was blocked and I still look at the parent process. If it did not, I decide whether the process is still running and whether isolation is warranted. I copy the hostname and the process into the ServiceNow ticket so Splunk is not my only record. CrowdStrike is the host. Splunk is the search across hosts.",
      },
      {
        question: "Where does Defender fit next to CrowdStrike?",
        answer: "I run both. CrowdStrike is the sensor I use for the process investigation and isolation. Defender is the Microsoft control on the same fleet, and it is what I check when the device identity is in Entra ID. At CVS I used Defender to confirm the prevention state and CrowdStrike when I needed the process timeline. If they disagree, I trust the timeline I can open and I write the disagreement in the ticket. I do not average the two consoles.",
      },
      {
        question: "What do you verify after you contain a laptop?",
        answer: "I confirm the host shows contained, I confirm the user cannot start the process I was chasing, and I confirm the account that owned the session is disabled in Active Directory or Entra ID. At Citi the vault side matters too if that account was privileged: CyberArk should show it disabled. Then I tell the owner in ServiceNow what the user needs in order to work again. Containment without that note is how a laptop stays isolated over a weekend.",
      },
    ],
    checklist: [
      { item: "Host first", brief: "Open the device, then the process tree." },
      { item: "Prevention", brief: "Say whether CrowdStrike or Defender blocked it." },
      { item: "Second console", brief: "Check the other sensor before you call it clean." },
      { item: "Identity", brief: "Disable the account, not only the laptop." },
      { item: "Ticket", brief: "Hostname and action go in ServiceNow." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "cloud-security",
    kind: "category",
    title: "Cloud Security (Azure)",
    blurb: "Azure identity, Defender, and Sentinel as the control plane.",
    dossier: "Cloud security in this pack is Azure. I hold the Azure Security Engineer Associate. At Citi the work is Entra ID, Defender for the cloud workloads I can see, and Sentinel as the place those signals land next to the rest of the detections. I do not describe a multi-region network migration or a firewall vendor cutover. I describe identity, logging, and the control that stops a subscription from drifting. A useful answer names the Azure control, who owns the subscription, and how I check it.",
    mustMention: ["Azure", "Entra ID", "Sentinel", "subscription", "identity"],
    avoid: ["Another cloud's network story", "A firewall cutover", "A cloud certification recited as experience", "Inventing a region count"],
    probes: [
      {
        question: "How do you secure an Azure subscription you inherit?",
        answer: "I start with who can change it. At Citi I look at Entra ID for the owners and the standing privileged roles, and I put privileged access through CyberArk where the break-glass and the admin path require it. Then I look at Defender for the recommendations that are actually open on that subscription, and I confirm the activity is reaching Sentinel. A subscription with no diagnostic logs is the finding. I write the owner and the gap in ServiceNow. I do not start by redrawing the network.",
      },
      {
        question: "What do you watch in Sentinel for Azure?",
        answer: "I watch the identity and the control-plane events, not every storage read. Sign-in from Entra ID, role assignment, and a Defender alert on the resource are the three I want in the same incident. At Citi those land in Sentinel beside the Splunk detections for the rest of the enterprise. If Sentinel has the role change and Splunk does not, I still treat the role change as the lead. The cloud control plane is the story. The SIEM is where I correlate it.",
      },
      {
        question: "How do you handle a public storage account or an open management port?",
        answer: "I confirm it is real in Defender, I name the subscription owner, and I close it or I record why it stays. At Citi I do not leave an exposure because the app team is busy. The ticket in ServiceNow has the resource, the owner, and the date they accepted it if they will not close it. Entra ID tells me who can still change that resource after the exception. An exception with no owner is not an exception. I remove the access path.",
      },
    ],
    checklist: [
      { item: "Owners", brief: "Entra ID roles on the subscription, named." },
      { item: "Privilege", brief: "Admin path through CyberArk where it is required." },
      { item: "Signals", brief: "Defender findings and logs in Sentinel." },
      { item: "Exposure", brief: "Public resource gets an owner and a ticket." },
      { item: "Scope", brief: "Azure only. No other cloud network story." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "appsec",
    kind: "category",
    title: "AppSec (Fortify)",
    blurb: "Fortify findings, the pipeline, and what the developer fixes.",
    dossier: "Application security here is Fortify in the build, not a generic lecture on the OWASP list. At Citi I use Fortify to see the findings on the applications I am responsible for, and I track the fix with the team that owns the code. The answer names the finding class, where it sits in the pipeline, and how I decide what is fixed before release. I do not claim a penetration-test trophy or a tool I do not run. I describe the scan, the triage, and the developer conversation.",
    mustMention: ["Fortify", "finding", "pipeline", "developer", "triage"],
    avoid: ["Reciting OWASP with no scan", "Claiming a bug bounty", "A tool other than Fortify as the scanner", "Calling every finding critical"],
    probes: [
      {
        question: "How do you triage a Fortify finding?",
        answer: "I open the finding in Fortify and I read the data flow, not the title. At Citi I check whether the source is real user input and whether the sink is the one the rule claims. If the path is not reachable, I mark it not exploitable and I write why. If it is reachable, I send the developer the file, the line, and the fix I expect, and I track it in ServiceNow until the next scan is clean. I do not accept a comment that says it will be fixed later with no build to prove it.",
      },
      {
        question: "Where does the scan sit in the pipeline?",
        answer: "The scan runs on the build the team is about to promote. I want Fortify on that pipeline so a new finding blocks the promotion or becomes a ticket with an owner before release. At Citi I look at the application version in the scan and I match it to the build. A scan of an old branch is not a release decision. If the pipeline skipped the scan, the release does not get a pass from me.",
      },
      {
        question: "How do you handle a finding the developer disagrees with?",
        answer: "I sit on the data flow with them. If they show me the control that already stops the input, I record that in Fortify and I close it as not exploitable. If they are arguing the severity because the date is close, the finding stays open. At Citi the disagreement is about the path, not about the calendar. ServiceNow holds the decision and the name of the person who accepted it when we leave a real finding in the release.",
      },
    ],
    checklist: [
      { item: "Data flow", brief: "Source and sink, not the rule title." },
      { item: "Reachable", brief: "Not exploitable only with a reason." },
      { item: "Build", brief: "The scan matches the build being promoted." },
      { item: "Owner", brief: "A developer and a ServiceNow ticket." },
      { item: "Rescan", brief: "The next Fortify run is the proof it is gone." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "vulnerability-management",
    kind: "category",
    title: "Vulnerability Mgmt (Qualys, Nessus, Tanium)",
    blurb: "Findings, owners, and proof the patch landed.",
    dossier: "Vulnerability management is the finding, the owner, and the proof of the fix. I use Qualys and Nessus for the scan, and Tanium when I need to see the host and push or confirm the state without waiting for the next scan window. At CVS those three sat on the same queue. At Citi Qualys and Nessus are how I show a team what is still open. A straight answer names the asset, the missing fix, the owner, and how I checked the host afterward. I do not quote a score as if the score were the work.",
    mustMention: ["Qualys", "Nessus", "Tanium", "owner", "patch"],
    avoid: ["A CVSS lecture with no asset", "Calling the scanner the patch tool", "A percentage that was not measured", "Closing a finding from the ticket alone"],
    probes: [
      {
        question: "How do you run a vulnerability cycle?",
        answer: "I take the Qualys or Nessus results for the assets in scope, I group them by the team that owns the host, and I put the missing fix in ServiceNow with the hostname and the due date. At CVS I used Tanium to confirm the host was the one in the scan and to see whether the patch was already present when the scanner was stale. I do not close the finding because the ticket moved. I close it when Qualys, Nessus, or Tanium shows the host in the fixed state.",
      },
      {
        question: "What do you do when the scanner and the endpoint disagree?",
        answer: "I believe the host I can query. At CVS, if Nessus still showed a finding and Tanium showed the patch installed, I checked the version on the host and I rescanned. If Tanium showed the patch missing, the scanner was early and the ticket stayed open. At Citi I do the same with Qualys. Disagreement is a reason to look at the host, not a reason to pick the console that makes the report cleaner.",
      },
      {
        question: "How do you get an owner to actually patch?",
        answer: "I give them the host list and the change window, not a spreadsheet of CVSS colors. The ServiceNow ticket names the application owner. I show up to the change with the Qualys or Nessus evidence and I verify in Tanium after they say it is done. At CVS that verification was the part that stopped a ticket from closing on a promise. A meeting without a rescan is a status meeting. I want the host state.",
      },
    ],
    checklist: [
      { item: "Asset", brief: "Hostname and the team that owns it." },
      { item: "Scanner", brief: "Qualys or Nessus is the finding of record." },
      { item: "Live state", brief: "Tanium when the scan may be stale." },
      { item: "Ticket", brief: "ServiceNow has the fix and the due date." },
      { item: "Proof", brief: "Rescan or host query before the ticket closes." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "grc",
    kind: "category",
    title: "GRC",
    blurb: "Control, evidence, and the exception with a name on it.",
    dossier: "GRC for me is the control I can show evidence for, not a policy binder. I hold the CISSP. At Citi and at CVS the evidence is the same operational work: access reviews in the identity systems, vulnerability tickets in ServiceNow, detections in Splunk and Sentinel, and endpoint state in CrowdStrike and Defender. An answer names the control, the evidence I pull, and what I do when the evidence is missing. I do not recite a framework chapter. I say which record proves the control this quarter.",
    mustMention: ["evidence", "control", "ServiceNow", "exception", "CISSP"],
    avoid: ["Naming a framework and stopping", "An exception with no owner", "Inventing an audit finding", "Treating policy text as proof"],
    probes: [
      {
        question: "How do you prove a control is operating?",
        answer: "I pick the control and I pull the record that shows it ran. For access, that is the SailPoint certification and the CyberArk account state at Citi. For vulnerabilities, that is the Qualys or Nessus ticket in ServiceNow and the rescan. For detection, that is the Splunk or Sentinel rule and a sample of how it was triaged. I do not attach the policy. The policy says what should happen. The ticket and the tool show that it did. If the record is missing, the control is not operating, and I open the gap with an owner.",
      },
      {
        question: "How do you handle an exception?",
        answer: "An exception has a name, a date, and a compensating control. At Citi I will not file an exception that says the team is busy. The ServiceNow record names the owner, the system, what stays open, and what I check in the meantime. If the compensating control is a tighter Entra ID role or a CyberArk approval, I verify that control is actually on. When the date passes, the exception expires. I do not let it become the new baseline.",
      },
      {
        question: "What does the CISSP change about how you talk to auditors?",
        answer: "It changes the order. I lead with the control objective and the evidence, then the tool. The CISSP is why I can sit in that conversation without translating every question into a product. At Citi I still open Splunk, SailPoint, or ServiceNow and show the record. The certification is not the evidence. The record is. I speak in the control, and I point at the system that holds the proof.",
      },
    ],
    checklist: [
      { item: "Control", brief: "One objective, said in a sentence." },
      { item: "Record", brief: "The tool that shows it ran this quarter." },
      { item: "Gap", brief: "Missing evidence is a ticket with an owner." },
      { item: "Exception", brief: "Name, date, compensating control." },
      { item: "Expiry", brief: "The exception ends. It does not become normal." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "network-security",
    kind: "category",
    title: "Network Security (Palo Alto)",
    blurb: "Palo Alto Cortex and the network path I could actually see.",
    dossier: "Network security in this pack is the work I did as a Network Security Engineer at Charter, and the Palo Alto Cortex detections I still use. Cortex is how I see the endpoint and the network detection together. I do not describe a firewall-vendor migration, a cloud backbone, or a data-center cutover. I describe the traffic or the host I investigated, the policy or the detection that mattered, and what I changed or escalated. At Charter that was the job. At Citi I still use Cortex when the detection is the network side of an endpoint alert.",
    mustMention: ["Palo Alto Cortex", "Charter", "detection", "host", "policy"],
    avoid: ["A firewall-vendor migration", "Another cloud's transit network", "A cutover narrative", "Inventing a packet capture I did not take"],
    probes: [
      {
        question: "How do you investigate a suspicious connection?",
        answer: "I start with the host and the destination, not with a speech about the perimeter. At Charter I used Palo Alto Cortex to see the device, the process, and the connection in one place. If the process is known and the destination is a sanctioned service, I document it and I move on. If the process is not what the host should run, I treat it as an endpoint incident and I bring CrowdStrike or Defender in where I have them. At Citi I do the same when Cortex is the detection that started the ticket. The connection is evidence. The process tells me whether it matters.",
      },
      {
        question: "What do you check before you call a block a success?",
        answer: "I check that the policy hit the traffic I named, and that the host stopped making the connection. A rule that exists and a connection that continues is not a block. At Charter I confirmed the Cortex event after the policy change, and I wrote the rule and the host in the ticket. I also check I did not block the path the business still needs. A broad block is easy. The check is the specific destination and the specific host.",
      },
      {
        question: "How does network detection meet the SOC queue?",
        answer: "Cortex detections that are real go into the same ServiceNow queue as the Splunk and Sentinel alerts. I do not keep a side channel. At Citi I attach the host, the destination, and the process so the next analyst does not re-open Cortex blind. If the detection is the network half of a CrowdStrike alert, I say that in the ticket. One incident, one record, both consoles named.",
      },
    ],
    checklist: [
      { item: "Pair", brief: "Host and destination before a theory." },
      { item: "Sensor", brief: "Palo Alto Cortex for the connection and the process." },
      { item: "Decision", brief: "Known process, or an endpoint incident." },
      { item: "Block", brief: "Confirm the host stopped. Do not trust the rule object." },
      { item: "Queue", brief: "ServiceNow, with both consoles named." },
    ],
    notebookLmUrl: empty,
  },
  {
    id: "leadership",
    kind: "category",
    title: "Leadership",
    blurb: "Ownership, the tradeoff, and the person who had to live with it.",
    dossier: "Leadership in these interviews is ownership of a security decision other people had to carry. At Citi I am the senior engineer in the room. At CVS I ran the operational follow-through on incidents and vulnerabilities. I do not talk about inspiring a team in the abstract. I name the decision, who disagreed, what I chose, and what I checked afterward. The CISSP is the language for the risk conversation. The tools are how I proved the choice held.",
    mustMention: ["decision", "owner", "disagreement", "ServiceNow", "follow-through"],
    avoid: ["A slogan about servant leadership", "Taking credit for a team's tool", "A story with no disagreement", "A canned close about walking the build"],
    probes: [
      {
        question: "Tell me about a time you pushed a fix the owner did not want.",
        answer: "At CVS a host owner wanted a Qualys finding left open through the next cycle. I put the hostname, the finding, and the exposure in the ServiceNow ticket and I said what I would accept instead: a tighter account in Active Directory and a date. They took the date. I checked Tanium when they said it was patched, and I closed the ticket on the host state, not on the meeting. The disagreement was about timing. The decision was that a promise is not a patch.",
      },
      {
        question: "How do you run a serious conversation with a manager who is not technical?",
        answer: "I lead with the effect on their operation, then the control. At Citi I will say which accounts can change production and what CyberArk changes about that path, before I name a feature. If they need a risk acceptance, I write the owner and the date in ServiceNow. I do not hide the residual risk in a tool name. The CISSP framing is the impact and the control. The proof is still the system.",
      },
      {
        question: "Tell me about a time you were wrong in an incident.",
        answer: "At CVS I scoped a host and I missed a second account in the same hour. The Splunk search the next shift ran showed it. I added the account to the ServiceNow record, I disabled it, and I wrote that the first scope was short. I did not defend the first ticket. The follow-through is the correction in the record and the check I added so the next search includes the account field I skipped.",
      },
    ],
    checklist: [
      { item: "Decision", brief: "What you chose, in one sentence." },
      { item: "Disagreement", brief: "Who pushed back, and about what." },
      { item: "Record", brief: "ServiceNow has the owner and the date." },
      { item: "Proof", brief: "A tool check after the meeting." },
      { item: "Correction", brief: "If the first call was short, the ticket says so." },
    ],
    notebookLmUrl: empty,
  },
]
