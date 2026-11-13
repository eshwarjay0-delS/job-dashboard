// Fix 4 (defensibility cycle): technical coherence validator. The tool, log source or event ID must fit the OS and the
// system (no PowerShell or Windows event IDs on a Linux sudo CVE), the tool must be able to show the data claimed, the
// detection must support the conclusion (one blocked connection doesn't prove "no exfiltration"), and the verification
// must prove the remediation (a rescan, a version check, a test that now fails; "we monitored" is not proof).
import { sentences, toolCategory, toolsIn } from "./kompasDefendText.ts"

export type Finding = { code: string; severity: "hard" | "major"; quote: string; why: string }
const LINUX = /\b(?:Linux|Ubuntu|RHEL|Red Hat|CentOS|Debian|sudo(?:ers)?|bash|auditd|syslog|journalctl|\/var\/log|cron(?:tab)?|systemd|sshd|SSH keys?|kernel|apt|yum|SELinux|Baron Samedit|CVE-2021-3156)\b/i
const WIN_TEL = /\b(?:Event ID|EventCode|event 4\d{3}|(?<![\d$.,])4(?:6|7)\d{2}(?![\d,.%])|PowerShell|Sysmon|registry|HKLM|HKCU|AppLocker|GPO|Group Policy|%AppData%|\w+\.exe\b|wevtutil|Windows Event|script ?block)\b/
const MIXED = /\b(?:Windows and Linux|Linux and Windows|both (?:Windows|Linux)|mixed fleet|cross-platform|on the Windows side|on the Linux side)\b/i
const CAP: Array<[string, RegExp]> = [
  ["the scanner", /\b(?:Event ID|event 4\d{3}|process (?:creation|tree)|PowerShell (?:logs?|execution)|sign-?in logs?|logon|packet|beacon\w*|C2|lateral movement|exfiltrat\w*)\b/i],
  ["the ticketing system", /\b(?:Event ID|event 4\d{3}|process (?:creation|tree)|PowerShell|sign-?in logs?|packet|beacon\w*|C2|lateral movement|exfiltrat\w*|malicious)\b/i],
  ["the identity provider", /\b(?:process (?:creation|tree)|Event ID 4688|4688|PowerShell (?:logs?|execution)|packet capture|CVE)\b/i],
  ["the firewall", /\b(?:process (?:creation|tree)|4688|PowerShell|registry|sign-?in logs?)\b/i],
  ["the access-review tool", /\b(?:process|4688|PowerShell|packet|beacon\w*|C2|CVE)\b/i],
  ["the mail gateway", /\b(?:process (?:creation|tree)|4688|registry|CVE)\b/i],
]
const NEG_PROOF = /\b(?:confirm\w*|prov(?:e|ed)|show(?:ed|s)?|verif\w*|knew|know) (?:that )?(?:there (?:was|were) )?(?:no|zero|nothing) (?:data |patient (?:data|records?) )?(?:exfiltration|lateral movement|data (?:loss|access|left)|compromise|access|spread|persistence|further (?:access|activity)|records? (?:accessed|taken))|\bno (?:lateral movement|exfiltration|data (?:left|was taken|loss))\b/i
const SCOPED = /\b(?:across (?:all|every|the (?:fleet|environment|estate))|every (?:host|account|endpoint|device|session)|scop\w*|timeline|egress|outbound|proxy logs?|flow logs?|DLP|packet|netflow|full (?:review|sweep|hunt)|hunt\w*|forensic\w*|image\w*|still (?:not sure|confirming|reviewing)|not (?:yet )?(?:certain|sure|confirmed)|couldn't (?:rule|prove)|as far as|based on (?:what|the))\b/i
const FIX_DONE = /\b(?:I|we|the team|they)\s+(?:\w+\s+){0,2}(?:patched|upgraded|rotated|reset|disabled|revoked|removed|reimaged|rebuilt|enforced|fixed|deployed (?:the )?(?:fix|patch)|applied (?:the )?(?:fix|patch)|closed (?:the )?port|turned on MFA|rolled out MFA|pushed (?:the )?(?:fix|patch))\b/i
const STRONG_VERIFY = /\b(?:re-?scan\w*|re-?test\w*|re-?ran|re-?run|rescan|version (?:check|string|now|was|showed|came back)|(?:package|build|kernel|sudo) version|came back clean|clean (?:scan|result|re-?scan)|no longer (?:show|appear|list|flag|return|fire|reach|connect|resolv|authenticat|work)\w*|(?:test|login|sign-?in|connection) (?:attempt|account)?\s*(?:failed|was denied|got denied|bounced)|tried (?:to )?[^.]{0,40}(?:failed|denied|blocked|couldn't)|query (?:came back|returned) (?:empty|zero|nothing|clean)|zero (?:hits|results|matches)|returned (?:nothing|zero|no)|confirmed (?:the )?(?:patch|fix|version|change|rule|block|policy|MFA)[^.]{0,40}(?:applied|in place|took|held|live|installed|enforced)|validated|verified (?:the )?(?:patch|fix|version|change|rule|block|policy|MFA)|(?:scan|check|test|query|review|report) (?:showed|confirmed|came back)[^.]{0,60}(?:clos|clean|fixed|gone|no longer|patched|compliant|applied))/i
const WEAK_VERIFY = /\b(?:monitor\w*|kept an eye|watch(?:ed|ing)?|no (?:new )?alerts|nothing (?:came up|fired)|didn't see (?:anything|any)|quiet since)\b/i
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function coherence(answer: string, node: { system?: string; artifacts?: string[] } | null = null): Finding[] {
  const t = String(answer || ""), S = sentences(t), f: Finding[] = []
  const add = (code: string, severity: Finding["severity"], quote: string, why: string) => f.push({ code, severity, quote: String(quote || "").slice(0, 180), why })
  const linux = LINUX.test(t) || LINUX.test(node?.system || "")
  const winS = S.find((s) => WIN_TEL.test(s))
  const winNode = (node?.artifacts || []).find((a) => WIN_TEL.test(a))
  if (linux && (winS || winNode) && !MIXED.test(t) && !/\bWindows\b/i.test(node?.system || "")) add("os-mismatch", "hard", winS || winNode || "", "Linux system with Windows-only telemetry (PowerShell, event IDs, registry, AppLocker)")
  S.forEach((s, i) => {
    for (const tool of toolsIn(s)) {
      const cap = CAP.find(([c]) => c === toolCategory(tool)); if (!cap) continue
      const m = s.match(cap[1])
      if (m && new RegExp(`${esc(tool.split(" ")[0])}[^.]{0,60}\\b(?:show(?:ed|s)?|flag(?:ged)?|log(?:ged)?|caught|detect\\w*|surfac\\w*|alert\\w*|had|gave)\\b[^.]{0,60}${esc(m[0])}`, "i").test(s)) add("tool-capability", "hard", s, `${tool} (${toolCategory(tool)}) can't show "${m[0]}"`)
    }
    if (NEG_PROOF.test(s) && !SCOPED.test(s) && !SCOPED.test(S[i - 1] || "")) add("detection-overreach", "hard", s, "a negative conclusion (no exfiltration / no lateral movement) needs scoped evidence, not one blocked connection")
  })
  const fixS = S.find((s) => FIX_DONE.test(s) && !/\b(?:I'd|would|if|plan to|going to)\b/i.test(s))
  if (fixS && !STRONG_VERIFY.test(t)) add(WEAK_VERIFY.test(t) ? "weak-verification" : "no-verification", "major", fixS, "the check must prove the fix (rescan, version, a test that now fails), not just watching alerts")
  return f
}
export const coherenceScore = (f: Finding[]): number => Math.max(0, 100 - 50 * f.filter((x) => x.severity === "hard").length - 25 * f.filter((x) => x.severity === "major").length)

export const COHERENCE_PROMPT = `TECHNICALLY COHERENT: the tool really shows that data (a scanner shows findings and versions, not process logs; a ticketing system shows approvals, not telemetry); the log source fits the OS (Linux: sudo/auth log, auditd, package versions; Windows: event IDs, PowerShell, Sysmon), never Windows telemetry on a Linux system. Never claim "no exfiltration" or "no lateral movement" from one check; say what was scoped and what is still unconfirmed. Prove a fix with a rescan, a version check or a test that now fails, never "we monitored".`
