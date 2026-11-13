// Shared text helpers for the Kompas defensibility checks (outside review of round-35, Nov 11 2026).
// Deterministic and dependency-free so the eval loop and the live answer path run the same code.

export function sentences(text: string): string[] {
  return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?]["'\u201d]?)\s+(?=["'\u201c(]?[A-Z0-9])/).map((s) => s.trim()).filter(Boolean)
}
export const words = (text: string): number => String(text || "").split(/\s+/).filter(Boolean).length

// Enterprise tools the checks recognise, each with the category it is called by when it is not the one named tool.
export const TOOL_CATEGORY: Array<[RegExp, string]> = [
  [/\b(?:Splunk(?: (?:ES|Enterprise Security|Enterprise))?|(?:Microsoft )?Sentinel|QRadar|Chronicle|Elastic|Sumo Logic|LogRhythm|ArcSight|Exabeam)\b/i, "the SIEM"],
  [/\b(?:CrowdStrike(?: Falcon)?|Falcon|Carbon Black|Cortex XDR|SentinelOne|Defender for Endpoint|Microsoft Defender|Tanium)\b/i, "the EDR"],
  [/\b(?:Entra(?: ID)?|Azure AD|Okta|Ping Identity|Duo)\b/i, "the identity provider"],
  [/\b(?:CyberArk|BeyondTrust|Thycotic|Delinea|HashiCorp Vault)\b/i, "the PAM vault"],
  [/\b(?:SailPoint(?: IdentityIQ)?|IdentityIQ|Saviynt)\b/i, "the access-review tool"],
  [/\b(?:Qualys(?: VMDR)?|Tenable(?:\.io)?|Nessus|Rapid7(?: InsightVM)?|InsightVM)\b/i, "the scanner"],
  [/\b(?:ServiceNow(?: GRC)?|Jira|Remedy)\b/i, "the ticketing system"],
  [/\b(?:Zscaler|Netskope)\b/i, "the proxy"],
  [/\b(?:Palo Alto|PAN-OS|FortiGate|Fortinet|Check Point|Cisco ASA)\b/i, "the firewall"],
  [/\b(?:Proofpoint|Mimecast)\b/i, "the mail gateway"],
  [/\b(?:Veracode|Checkmarx|SonarQube|Snyk)\b/i, "the code scanner"],
  [/\b(?:Intune|SCCM|Jamf)\b/i, "the endpoint management tool"],
  [/\b(?:Wiz|Lacework|Orca|Prisma Cloud|GuardDuty|Security Hub|Defender for Cloud)\b/i, "the cloud security tooling"],
  [/\b(?:CloudTrail)\b/i, "the cloud audit logs"],
  [/\b(?:Wireshark|Zeek|Suricata)\b/i, "the network sensor"],
]
export function toolsIn(text: string): string[] {
  const t = String(text || "")
  const out: string[] = []
  for (const [re] of TOOL_CATEGORY) {
    const g = new RegExp(re.source, "gi")
    for (const m of t.matchAll(g)) { const name = m[0]; if (!out.some((x) => x.toLowerCase().split(" ")[0] === name.toLowerCase().split(" ")[0])) out.push(name) }
  }
  return out
}
export function toolCategory(tool: string): string {
  for (const [re, cat] of TOOL_CATEGORY) if (re.test(tool)) return cat
  return "the tool"
}

export const SIGNER = /\b(?:CISO|deputy CISO|change (?:advisory )?board|CAB|change manager|business owner|risk owner|data owner|system owner|control owner|app(?:lication)? owner|IR lead|incident (?:lead|commander|manager)|SOC (?:lead|manager)|security manager|team lead|risk manager|VP|director|general counsel|legal|privacy officer|audit committee|board|CFO|CIO|CTO|delegate|my manager|the manager|risk committee|compliance)\b/i
export const DECIDE = /\b(?:signs?|signed|sign-?off|approv\w*|decid\w*|authority|accountable|owns? the (?:risk|decision|call|exception)|accepts? the risk|accepted the risk|makes? the call|made the call|call (?:was|is) (?:theirs|his|hers|mine)|their call|has to (?:sign|approve)|can (?:approve|sign))\b/i
export const FIRST_ACT = /\b(?:I|we)(?:'d| would| usually| also| then| first)?\s+(?!think|feel|believe|guess|mean|know|am|was|were|'m|hope|wish|like|love|want)[a-z-]{3,}\b/i
export const VERIFY = /\b(?:confirm\w*|verif\w*|re-?scan\w*|re-?test\w*|re-?ran|re-?run|check(?:ed|s)?|came back|showed|validat\w*|no longer|prov(?:e|ed)|evidence|returned|tested|test (?:login|account|case)|tried|failed (?:as expected|to)|denied|clean scan|version|query)\b/i

const STOP = new Set("what when where which while would could should your have with that this there they them their from into about tell describe walk through time times give using used doing done does how who whom why you yours yourself some someone something thing things also just only very really make made like more most much many other others still then than were been being because after before during over under again ever every each kind sort example situation case cases happened happen actually exactly".split(" "))
export const contentWords = (s: string): string[] => (String(s).match(/[A-Za-z][A-Za-z-]{3,}/g) || []).filter((w) => !STOP.has(w.toLowerCase()))
export const stem = (w: string): string => w.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 5)

// Sub-questions: "What do you do first, who has the authority, and how do you confirm it?" -> three asks.
export function subQuestions(question: string): string[] {
  const q = String(question).replace(/\s+/g, " ").trim()
  const out: string[] = []
  for (const sent of q.split(/(?<=[?.])\s+/)) {
    if (!/\?$/.test(sent) && !/^(?:tell me|describe|walk me|explain|give me)\b/i.test(sent)) continue
    for (let part of sent.split(/,\s*(?:and\s+)?(?=(?:what|who|how|when|where|why|which|do you|would you|did you)\b)|\s+and\s+(?=(?:what|who|how|when|where|why|which|do you|would you|did you)\b)/i)) {
      part = part.replace(/[?.]$/, "").trim()
      if (part.split(/\s+/).length >= 2) out.push(part)
    }
  }
  return out.length ? out : [q]
}
