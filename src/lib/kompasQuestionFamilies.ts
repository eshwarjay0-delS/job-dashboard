// Fix 8 (defensibility cycle): new question families with mandatory-part checklists: mistakes, technical interrogation,
// GRC judgment, architecture, leadership without authority, live interruptions (the interviewer cuts in after a weak
// answer; "prev" is that earlier turn). Holdout ids are judged by an independent model and never tuned on.
import type { PrevTurn } from "./kompasChecklist.ts"

export type FamilyQuestion = { id: string; family: string; question: string; checklist: Array<{ key: string; text: string; re: string; mandatory?: boolean }>; prev?: PrevTurn; holdout: boolean }
export const FAMILIES = ["mistakes", "technical", "grc", "architecture", "leadership", "interruption"] as const

export const FAMILY_QUESTIONS: FamilyQuestion[] = [
  {
    "id": "m001",
    "family": "mistakes",
    "question": "Tell me about a security decision you made that turned out to be wrong. How did you find out, and what did you change?",
    "checklist": [
      {
        "key": "how-found",
        "text": "how he found out it was wrong",
        "re": "\\b(?:found out|realized|noticed|caught|showed|came back|pointed out|flagged|saw)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m002",
    "family": "mistakes",
    "question": "Describe a vulnerability you missed. Why did you miss it, and what do you do differently now?",
    "checklist": [
      {
        "key": "why-missed",
        "text": "why he missed it",
        "re": "\\b(?:because|since|the reason|I assumed|I trusted)\\b"
      },
      {
        "key": "differently-now",
        "text": "what he does differently now",
        "re": "\\b(?:now I|now we|these days|since then|I (?:added|changed|started|check))\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m003",
    "family": "mistakes",
    "question": "When did one of your security recommendations cause an operational problem? What broke, who was affected, and how did you fix it?",
    "checklist": [
      {
        "key": "what-broke",
        "text": "what broke",
        "re": "\\b(?:broke|failed|stopped|locked out|went down|couldn't|outage)\\b"
      },
      {
        "key": "who-affected",
        "text": "who was affected",
        "re": "\\b(?:users?|team|staff|customers?|pharmac\\w*|traders?|clerks?|agents?|helpdesk|nurses?)\\b"
      },
      {
        "key": "how-fixed",
        "text": "how he fixed it",
        "re": "\\b(?:rolled back|reverted|fixed|restored|exception|changed|re-?enabled)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m004",
    "family": "mistakes",
    "question": "Tell me about a time your manager disagreed with your assessment and turned out to be right.",
    "checklist": [
      {
        "key": "concede",
        "text": "says plainly the manager was right",
        "re": "\\b(?:(?:she|he|they) (?:was|were) right|my (?:manager|lead) was right|I was wrong|I had (?:over|under)\\w+|I'd (?:over|under)\\w+)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m005",
    "family": "mistakes",
    "question": "What security project failed under your ownership, and what was your part in the failure?",
    "checklist": [
      {
        "key": "my-part",
        "text": "his own part in the failure",
        "re": "\\b(?:my (?:part|mistake|fault|call)|I (?:\\w+ )?(?:underestimated|didn't|missed|pushed|assumed|scoped|picked|skipped))\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m006",
    "family": "mistakes",
    "question": "Tell me about a security incident where your initial investigation was incorrect. What made you change course?",
    "checklist": [
      {
        "key": "change-course",
        "text": "what made him change course",
        "re": "\\b(?:then|when|after|until)\\b[^.]{0,80}\\b(?:showed|came back|realized|noticed|found|pointed)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "m007",
    "family": "mistakes",
    "question": "When did you have to admit in front of a team that you didn't know something? What did you do next?",
    "checklist": [
      {
        "key": "next-step",
        "text": "what he did next",
        "re": "\\bI (?:went|looked|asked|read|pulled|called|found|checked|came back|followed up|booked)\\b"
      }
    ],
    "holdout": true
  },
  {
    "id": "t001",
    "family": "technical",
    "question": "Walk me through exactly how you investigated an incident from the first alert to closure.",
    "checklist": [
      {
        "key": "first-alert",
        "text": "the first alert and what it showed",
        "re": "\\b(?:alert|detection|fired|flagged|ticket)\\b"
      },
      {
        "key": "scoping",
        "text": "how he scoped it",
        "re": "\\b(?:scop\\w*|other (?:hosts|accounts|users)|how far|blast radius|timeline)\\b"
      },
      {
        "key": "containment",
        "text": "the containment step",
        "re": "\\b(?:isolat|contain|disabl|block|reset|revok)\\w*"
      },
      {
        "key": "closure",
        "text": "how it was closed",
        "re": "\\b(?:clos\\w*|root cause|post-?incident|lessons|handed)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "t002",
    "family": "technical",
    "question": "What evidence would distinguish legitimate PowerShell administration from malicious execution?",
    "checklist": [
      {
        "key": "parent",
        "text": "the parent process",
        "re": "\\bparent\\b"
      },
      {
        "key": "command-line",
        "text": "the command line itself",
        "re": "\\b(?:command line|encoded|-enc\\w*|script ?block|arguments|obfuscat\\w*)\\b"
      },
      {
        "key": "context",
        "text": "the admin context (who, when, change ticket, signed script)",
        "re": "\\b(?:baseline|change ticket|known admin|signed|who ran|scheduled|expected|service account|maintenance)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "t003",
    "family": "technical",
    "question": "How do you validate that a SIEM rule isn't suppressing real attacks?",
    "checklist": [
      {
        "key": "test",
        "text": "a test with known-bad activity",
        "re": "\\b(?:test\\w*|simulat\\w*|atomic|replay\\w*|inject\\w*|known-bad|purple)\\b"
      },
      {
        "key": "suppression",
        "text": "review of suppressions and exclusions",
        "re": "\\b(?:suppress\\w*|exclusion\\w*|whitelist\\w*|allowlist\\w*|filter\\w*|tuning)\\b"
      },
      {
        "key": "ongoing",
        "text": "how it stays checked over time",
        "re": "\\b(?:review|periodic|every|quarter\\w*|after (?:each|every) change|monthly)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "t004",
    "family": "technical",
    "question": "Explain how you would investigate suspicious Kerberos activity on a Windows domain.",
    "checklist": [
      {
        "key": "events",
        "text": "the right events or tickets",
        "re": "\\b(?:4768|4769|4771|TGT|TGS|service tickets?)\\b"
      },
      {
        "key": "attack-type",
        "text": "what attack it could be",
        "re": "\\b(?:kerberoast\\w*|golden ticket|silver ticket|AS-REP|pass-the-ticket|RC4|encryption type)\\b"
      },
      {
        "key": "next-step",
        "text": "what he does about it",
        "re": "\\b(?:service account|reset|rotate|krbtgt|scope|disable)\\w*"
      }
    ],
    "holdout": false
  },
  {
    "id": "t005",
    "family": "technical",
    "question": "How would you investigate a compromised privileged identity, and how do you know when it's contained?",
    "checklist": [
      {
        "key": "first-action",
        "text": "the first containment action",
        "re": "\\b(?:disabl|revok|reset|kill (?:the )?sessions|suspend|block)\\w*"
      },
      {
        "key": "scope",
        "text": "what the identity touched",
        "re": "\\b(?:what (?:it|they) touched|sign-?in (?:logs|history)|audit logs?|scope|timeline|other systems|changes? (?:it|they) made)\\b"
      },
      {
        "key": "contained",
        "text": "how he knows it's contained",
        "re": "\\b(?:contained|no (?:further|new)|sessions? (?:revoked|killed)|tokens? (?:revoked|invalidated)|still (?:not sure|watching|confirming))\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "t006",
    "family": "technical",
    "question": "What would make you reject an EDR finding as a false positive, and what would make you keep digging?",
    "checklist": [
      {
        "key": "reject",
        "text": "what makes it a false positive",
        "re": "\\b(?:signed|known|baseline|expected|change ticket|vendor|hash|legitimate)\\b"
      },
      {
        "key": "dig",
        "text": "what makes him keep digging",
        "re": "\\b(?:unsigned|encoded|unusual parent|network|outbound|persistence|other hosts|new|rare)\\b"
      }
    ],
    "holdout": true
  },
  {
    "id": "t007",
    "family": "technical",
    "question": "How do you validate a vulnerability finding you can't reproduce?",
    "checklist": [
      {
        "key": "version",
        "text": "a version or configuration check",
        "re": "\\b(?:version|package|build|banner|config\\w*|registry|patch level)\\b"
      },
      {
        "key": "decision",
        "text": "what he decides if it stays unproven",
        "re": "\\b(?:compensating|exception|risk|owner|retest|rescan|false positive|vendor)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "r001",
    "family": "grc",
    "question": "What's the difference between accepting a risk and transferring it? Give me an example of when you'd choose each.",
    "checklist": [
      {
        "key": "acceptance",
        "text": "what acceptance means",
        "re": "\\baccept\\w*"
      },
      {
        "key": "transfer",
        "text": "what transfer means",
        "re": "\\b(?:transfer\\w*|insurance|contract\\w*|vendor|third party)\\b"
      },
      {
        "key": "example",
        "text": "an example of each",
        "re": "\\b(?:for example|for instance|when|at (?:Citi|CVS|the City|Charter)|say)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "r002",
    "family": "grc",
    "question": "An auditor rejects the evidence you gave for a control. What do you do?",
    "checklist": [
      {
        "key": "gap",
        "text": "what the auditor actually needed",
        "re": "\\b(?:what (?:they|the auditor) (?:needed|wanted|asked)|gap|criteria|why (?:it|they)|requirement)\\b"
      },
      {
        "key": "interim",
        "text": "interim evidence, honestly labelled",
        "re": "\\b(?:interim|meantime|for now|substitute|alternative evidence|partial)\\b"
      },
      {
        "key": "fix",
        "text": "the fix to the control or process",
        "re": "\\b(?:process|attestation|owner|going forward|fix the control|sign-?off|formal)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "r003",
    "family": "grc",
    "question": "Your CISO asks you to close a risk exception even though nothing has been remediated. How do you respond?",
    "checklist": [
      {
        "key": "no-false-close",
        "text": "won't record it as remediated",
        "re": "\\b(?:can't|won't|not going to|wouldn't|don't) (?:just )?(?:close|mark|call|record)|\\b(?:still open|not remediated|hasn't been (?:fixed|remediated)|nothing (?:has|was) (?:changed|fixed))\\b"
      },
      {
        "key": "alternative",
        "text": "the honest alternative (renew, re-accept, compensating control)",
        "re": "\\b(?:extend|renew\\w*|re-?approv\\w*|risk acceptance|accept the risk|new expiry|compensating|re-?sign)\\b"
      },
      {
        "key": "owner",
        "text": "who signs the residual risk",
        "re": "\\b(?:CISO|risk owner|business owner)\\b[^.]{0,60}\\b(?:sign|accept|own|decide)\\w*"
      }
    ],
    "holdout": false
  },
  {
    "id": "r004",
    "family": "grc",
    "question": "How do you decide whether compensating controls are sufficient?",
    "checklist": [
      {
        "key": "same-risk",
        "text": "whether it stops the same attack path",
        "re": "\\b(?:same (?:risk|threat|attack)|attack path|what (?:it|the control) (?:stops|blocks|covers)|exploit\\w*)\\b"
      },
      {
        "key": "test",
        "text": "how it is tested",
        "re": "\\b(?:test\\w*|verif\\w*|prove|evidence)\\b"
      },
      {
        "key": "expiry",
        "text": "the expiry or review date",
        "re": "\\b(?:expir\\w*|review date|time-?limit\\w*|until|deadline)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "r005",
    "family": "grc",
    "question": "A business owner refuses to accept a critical risk but also won't fund the fix. What happens next?",
    "checklist": [
      {
        "key": "escalation",
        "text": "where it goes next",
        "re": "\\b(?:escalat\\w*|CISO|risk committee|above|their (?:VP|director|boss))\\b"
      },
      {
        "key": "record",
        "text": "how it is recorded",
        "re": "\\b(?:risk register|document\\w*|record\\w*|on record|written)\\b"
      },
      {
        "key": "interim",
        "text": "what protects it meanwhile",
        "re": "\\b(?:interim|compensating|meantime|for now|until)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "r006",
    "family": "grc",
    "question": "How do you defend a risk rating that the business thinks is exaggerated?",
    "checklist": [
      {
        "key": "evidence",
        "text": "the evidence behind the rating",
        "re": "\\b(?:evidence|exploit\\w*|exposure|data|likelihood|impact)\\b"
      },
      {
        "key": "listen",
        "text": "what he takes from their view",
        "re": "\\b(?:their (?:point|view|concern)|fair|understand|what they (?:know|see)|they (?:know|had a point))\\b"
      },
      {
        "key": "change-if",
        "text": "what would change the rating",
        "re": "\\b(?:if|would change|lower|adjust\\w*|re-?rate)\\b"
      }
    ],
    "holdout": true
  },
  {
    "id": "r007",
    "family": "grc",
    "question": "The control owner and the risk owner disagree about whether a control is working. How do you resolve it?",
    "checklist": [
      {
        "key": "roles",
        "text": "the two roles and what each owns",
        "re": "\\b(?:control owner|risk owner)\\b"
      },
      {
        "key": "test",
        "text": "the test or evidence that settles it",
        "re": "\\b(?:test\\w*|evidence|sample|walkthrough)\\b"
      },
      {
        "key": "decision",
        "text": "who decides if they still disagree",
        "re": "\\b(?:decid\\w*|sign\\w*|accept\\w*|escalat\\w*)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "a001",
    "family": "architecture",
    "question": "Design privileged access management for a large enterprise. Where do you start?",
    "checklist": [
      {
        "key": "inventory",
        "text": "finding the privileged accounts first",
        "re": "\\b(?:inventor\\w*|discover\\w*|find (?:all|every)|which accounts|list)\\b"
      },
      {
        "key": "controls",
        "text": "vaulting, just-in-time or rotation",
        "re": "\\b(?:vault\\w*|just-in-time|JIT|check-?out|rotat\\w*|session record\\w*)\\b"
      },
      {
        "key": "phasing",
        "text": "the order he rolls it out",
        "re": "\\b(?:phase|first|start with|pilot|tier)\\w*"
      }
    ],
    "holdout": false
  },
  {
    "id": "a002",
    "family": "architecture",
    "question": "Design incident response logging across AWS and Azure for a small team.",
    "checklist": [
      {
        "key": "sources",
        "text": "the native log sources",
        "re": "\\b(?:CloudTrail|Activity Log|sign-?in logs|Entra|flow logs|audit logs?)\\b"
      },
      {
        "key": "central",
        "text": "where they land",
        "re": "\\b(?:central\\w*|one place|SIEM|single|workspace)\\b"
      },
      {
        "key": "small-team",
        "text": "what makes it work for a small team",
        "re": "\\b(?:small team|automat\\w*|alert on|few|limited|only the)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "a003",
    "family": "architecture",
    "question": "How would you centralize logging across several business units that each run their own tools?",
    "checklist": [
      {
        "key": "transport",
        "text": "how logs move",
        "re": "\\b(?:API|forwarder|syslog|connector|export|agent|HEC)\\b"
      },
      {
        "key": "ownership",
        "text": "who owns what",
        "re": "\\b(?:owner\\w*|each (?:unit|team)|business units?)\\b"
      },
      {
        "key": "start",
        "text": "what goes first",
        "re": "\\b(?:start|first|phase|priority|priorit\\w*)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "a004",
    "family": "architecture",
    "question": "Design a zero-trust access approach for a hybrid workforce. What do you do first?",
    "checklist": [
      {
        "key": "identity",
        "text": "identity and device signals",
        "re": "\\b(?:identity|MFA|conditional access|device)\\b"
      },
      {
        "key": "hybrid",
        "text": "what changes for remote vs office",
        "re": "\\b(?:remote|office|hybrid|home|on-prem)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "a005",
    "family": "architecture",
    "question": "How would you secure a third-party integration that handles patient data?",
    "checklist": [
      {
        "key": "data",
        "text": "limit the patient data shared",
        "re": "\\b(?:patient|PHI|minimum|least)\\b"
      },
      {
        "key": "contract",
        "text": "the contract side",
        "re": "\\b(?:BAA|business associate|contract|agreement|vendor (?:review|assessment))\\b"
      },
      {
        "key": "technical",
        "text": "the technical control on the connection",
        "re": "\\b(?:token|API key|scope\\w*|encrypt\\w*|mTLS|rotat\\w*)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "a006",
    "family": "architecture",
    "question": "How would you build detection coverage for identity compromise?",
    "checklist": [
      {
        "key": "signals",
        "text": "the identity signals",
        "re": "\\b(?:impossible travel|MFA fatigue|new device|sign-?in|token|consent|risky)\\b"
      },
      {
        "key": "test",
        "text": "how coverage is tested",
        "re": "\\b(?:test\\w*|simulat\\w*|tun\\w*|false positive)\\b"
      },
      {
        "key": "response",
        "text": "what happens when it fires",
        "re": "\\b(?:revok\\w*|disabl\\w*|reset|playbook)\\b"
      }
    ],
    "holdout": true
  },
  {
    "id": "l001",
    "family": "leadership",
    "question": "Tell me about a time you influenced a team without having authority over them.",
    "checklist": [
      {
        "key": "their-goal",
        "text": "what that team cared about",
        "re": "\\b(?:their (?:priorit\\w*|goal|deadline|concern|release|launch)|what they (?:cared|needed))\\b"
      },
      {
        "key": "how",
        "text": "how he moved them",
        "re": "\\b(?:showed|offered|made it easy|paired|wrote|built|sat with)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "l002",
    "family": "leadership",
    "question": "How do you handle an engineer who keeps ignoring security requirements?",
    "checklist": [
      {
        "key": "why",
        "text": "finding out why",
        "re": "\\b(?:why|understand|ask\\w*|reason)\\b"
      },
      {
        "key": "make-easy",
        "text": "making the secure way the easy way",
        "re": "\\b(?:template|guardrail|pipeline|default|make it easy|automat\\w*|check in the)\\b"
      },
      {
        "key": "escalate-if",
        "text": "when it goes to their manager",
        "re": "\\b(?:escalat\\w*|manager|lead)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "l003",
    "family": "leadership",
    "question": "Your security team is understaffed. What do you stop doing?",
    "checklist": [
      {
        "key": "stop",
        "text": "what he stops",
        "re": "\\b(?:stop|drop|pause|defer|park)\\w*"
      },
      {
        "key": "why",
        "text": "why that and not something else",
        "re": "\\b(?:because|since|risk)\\b"
      },
      {
        "key": "who-agrees",
        "text": "who agrees to the cut",
        "re": "\\b(?:CISO|manager|leadership|agree\\w*|sign\\w*)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "l004",
    "family": "leadership",
    "question": "Two regulatory deadlines land in the same month. How do you prioritize?",
    "checklist": [
      {
        "key": "criteria",
        "text": "the criteria",
        "re": "\\b(?:penalt\\w*|exposure|regulator\\w*|impact|consequence|fine)\\b"
      },
      {
        "key": "tell",
        "text": "who he tells",
        "re": "\\b(?:CISO|compliance|legal|leadership|tell)\\b"
      }
    ],
    "holdout": false
  },
  {
    "id": "l005",
    "family": "leadership",
    "question": "Tell me about a time you changed your mind after getting feedback.",
    "checklist": [],
    "holdout": false
  },
  {
    "id": "l006",
    "family": "leadership",
    "question": "What would you do if a business executive knowingly bypassed a security control?",
    "checklist": [
      {
        "key": "first",
        "text": "the first step",
        "re": "\\b(?:first|start|talk|ask)\\w*"
      },
      {
        "key": "record",
        "text": "how it is recorded",
        "re": "\\b(?:document\\w*|record\\w*|risk|exception)\\b"
      },
      {
        "key": "escalate",
        "text": "where it goes",
        "re": "\\b(?:CISO|escalat\\w*|their (?:boss|manager)|audit)\\b"
      }
    ],
    "holdout": true
  },
  {
    "id": "i001",
    "family": "interruption",
    "question": "Stop. That's not what I asked.",
    "checklist": [
      {
        "key": "authority",
        "text": "answers who approves the change",
        "re": "\\b(?:change (?:advisory )?board|CAB|change manager|CISO|emergency)\\b"
      }
    ],
    "prev": {
      "q": "Who has the authority to approve a firewall rule change during a change freeze?",
      "a": "I'd start by looking at the rule itself in the change system, checking the source and destination, and making sure it doesn't open anything broad. Then I'd test it in staging and compare the logs before and after."
    },
    "holdout": false
  },
  {
    "id": "i002",
    "family": "interruption",
    "question": "Give me a concrete example.",
    "checklist": [],
    "prev": {
      "q": "How do you handle pushback from an application owner on a critical patch?",
      "a": "I frame it in business terms, offer a maintenance window or a compensating control, and escalate if needed."
    },
    "holdout": false
  },
  {
    "id": "i003",
    "family": "interruption",
    "question": "You're using too many tools. Pick one.",
    "checklist": [],
    "prev": {
      "q": "How do you detect lateral movement?",
      "a": "I'd use Splunk to correlate 4624 logons, Defender for the process trees, Tanium for live queries and CrowdStrike for the host timeline, then cross-check in Sentinel."
    },
    "holdout": false
  },
  {
    "id": "i004",
    "family": "interruption",
    "question": "That doesn't sound technically correct.",
    "checklist": [
      {
        "key": "concede",
        "text": "concedes the mistake plainly",
        "re": "\\b(?:you're right|right,|good catch|that was wrong|I misspoke|not PowerShell|that's Windows|wrong (?:log|source))\\b"
      },
      {
        "key": "correct",
        "text": "gives the correct Linux check",
        "re": "\\b(?:sudo -V|sudo --version|package version|dpkg|rpm|apt|yum|rescan|auth\\.log|auditd|version)\\b"
      }
    ],
    "prev": {
      "q": "How would you confirm a Linux server was patched for the sudo vulnerability?",
      "a": "I'd check the PowerShell logs and Event ID 4688 for sudo executions after the patch window."
    },
    "holdout": false
  },
  {
    "id": "i005",
    "family": "interruption",
    "question": "I don't believe that was your responsibility. What exactly did you do?",
    "checklist": [],
    "prev": {
      "q": "Tell me about a ransomware incident you handled.",
      "a": "At CVS I led the response to a ransomware outbreak, contained 40 servers, negotiated with the business and restored everything in a day."
    },
    "holdout": false
  },
  {
    "id": "i006",
    "family": "interruption",
    "question": "You said the incident was contained. How do you know?",
    "checklist": [
      {
        "key": "evidence",
        "text": "the evidence for containment",
        "re": "\\b(?:sign-?in (?:logs|history)|sessions?|tokens?|mailbox rules?|forwarding|other (?:users|recipients)|no (?:further|new)|message trace)\\b"
      },
      {
        "key": "unknown",
        "text": "what was still not certain",
        "re": "\\b(?:still|not (?:yet )?(?:sure|certain)|couldn't (?:rule|prove)|unconfirmed|as far as)\\b"
      }
    ],
    "prev": {
      "q": "Walk me through a phishing incident you worked.",
      "a": "A user clicked a credential phishing link, we reset the password, blocked the domain at the mail gateway and the incident was contained."
    },
    "holdout": false
  },
  {
    "id": "i007",
    "family": "interruption",
    "question": "Let's assume your proposed solution fails. Now what?",
    "checklist": [],
    "prev": {
      "q": "How would you stop MFA fatigue attacks?",
      "a": "I'd turn on number matching for push notifications so users have to type the code shown on the sign-in screen."
    },
    "holdout": false
  },
  {
    "id": "i008",
    "family": "interruption",
    "question": "Explain that without technical terminology.",
    "checklist": [],
    "prev": {
      "q": "What is Kerberoasting?",
      "a": "It's an attack where an adversary requests TGS tickets for SPNs that use RC4 encryption and cracks them offline to recover service account passwords."
    },
    "holdout": false
  },
  {
    "id": "i009",
    "family": "interruption",
    "question": "Can you answer that in 20 seconds?",
    "checklist": [],
    "prev": {
      "q": "How do you prioritize vulnerabilities when there are thousands of open findings?",
      "a": "There are a lot of factors. I'd look at CVSS, but CVSS alone isn't enough, so I'd also look at exploitability, whether there's a known exploit in the wild, the asset's criticality, whether it's internet-facing, compensating controls, the business owner's tolerance, the patch availability, and then I'd build a risk-based queue with the owners and agree SLAs..."
    },
    "holdout": true
  }
]

export const familyOf = (id: string): string | undefined => FAMILY_QUESTIONS.find((q) => q.id === id)?.family
