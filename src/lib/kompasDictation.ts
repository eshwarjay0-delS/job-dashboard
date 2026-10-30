/**
 * What it prevents: a technical term being spent out of Whisper's prompt, or
 * left misspelled after the decode. The repairs are narrow phrases. A sentence
 * that does not contain one is returned unchanged, and running them twice
 * returns the same line.
 */

export const ACCURACY_TERMS = [
  "V-Cert", "Venafi TPP", "Venafi", "Luna HSM", "PKCS#10", "Gemalto", "Fifth Third",
  "CyberArk", "PowerShell", "Base64", "REST API", "Group Policy", "Kerberos",
  "SIEM", "domain controller", "MITRE ATT&CK", "Active Directory", "Microsoft Sentinel",
  "Qualys", "Nessus", "Splunk", "SAML", "OAuth", "PKI", "CrowdStrike",
  "Kubernetes", "Terraform", "STAR",
] as const

const CANON = new Map(ACCURACY_TERMS.map((term) => [term.toLowerCase(), term]))

const PROMPT_TOKEN_BUDGET = 200
const PROMPT_CHAR_BUDGET = 700

function estimateTokens(text: string): number {
  let tokens = 0
  for (const character of text) tokens += character.charCodeAt(0) < 128 ? 0.34 : 2
  return Math.ceil(tokens)
}

/** The prompt Whisper actually receives: script seed, then ranked terms, inside the token budget. */
export function accuracyPrompt(terms: readonly string[], seed = ""): string {
  const kept: string[] = []
  let used = 0
  if (seed.trim() !== "") {
    kept.push(seed.trim())
    used = estimateTokens(seed)
  }
  for (const term of rankHintTerms(terms)) {
    const trimmed = term.trim()
    if (!trimmed) continue
    const cost = estimateTokens(trimmed) + (kept.length > 0 ? 1 : 0)
    if (used + cost > PROMPT_TOKEN_BUDGET) break
    if (trimmed.length > PROMPT_CHAR_BUDGET) break
    kept.push(trimmed)
    used += cost
  }
  return kept.join(", ")
}

/** Drop the label Whisper would echo, float the interview terms, and park a long previous line at the end. */
export function rankHintTerms(terms: readonly string[]): string[] {
  const front: string[] = []
  const mid: string[] = []
  const back: string[] = []
  const seen = new Set<string>()
  const push = (bucket: string[], term: string) => {
    const id = term.toLowerCase()
    if (seen.has(id)) return
    seen.add(id)
    bucket.push(term)
  }
  for (const raw of terms) {
    const pieces = String(raw || "").split(/\bvocabulary:\s*/i)
    for (const piece of pieces) {
      const term = piece.replace(/\s+/g, " ").trim().replace(/[.,]+$/g, "")
      if (!term || /^vocabulary:?$/i.test(term)) continue
      const canon = CANON.get(term.toLowerCase())
      const words = term.split(/\s+/).length
      if (canon) push(front, canon)
      else if (words > 12) push(back, term)
      else push(mid, term)
    }
  }
  return [...front, ...mid, ...back]
}

const REPAIRS: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\bdomain control(?:ler|er| her| a)\b/gi, "domain controller"],
  [/\b(?:mitre|miter|myter) attack\b/gi, "MITRE ATT&CK"],
  [/\b(?:kerberose|curberos|kerbraus)\b/gi, "Kerberos"],
  [/\bsock (analyst|team|center|centre|manager|lead)\b/gi, "SOC $1"],
  [/\b(?:seam|sim) (tool|platform|solution|system|logs?)\b/gi, "SIEM $1"],
  [/\boh auth\b/gi, "OAuth"],
  [/\bcrowd strike\b/gi, "CrowdStrike"],
  [/\blatteral movement\b/gi, "lateral movement"],
  [/\bprivilege excalation\b/gi, "privilege escalation"],
  [/\bactive directory\b/gi, "Active Directory"],
  [/\bvee\s+cert\b/gi, "V-Cert"],
  [/\bwe\s+cert\b/gi, "V-Cert"],
  [/\bv[-\s]?cert\b/gi, "V-Cert"],
  [/\bvenaf(?:i|ee|y)(?:\s+tpp)?\b/gi, (match) => /tpp/i.test(match) ? "Venafi TPP" : "Venafi"],
  [/\bluna hsm\b/gi, "Luna HSM"],
  [/\bpkcs\s*(?:number|no\.?|#)?\s*ten\b/gi, "PKCS#10"],
  [/\bpkcs\s+(?:number|no\.?)\s+10\b/gi, "PKCS#10"],
  [/\bpkcs\s*#?\s*10\b/gi, "PKCS#10"],
  [/\bgemalto\b/gi, "Gemalto"],
  [/\bpower\s*shell\b/gi, "PowerShell"],
  [/\bbase\s+64\b(?!\s*-?\s*bits?\b)/gi, "Base64"],
  [/\brest\s+api\b/gi, "REST API"],
  [/\bgroup\s+policy\b/gi, "Group Policy"],
  [/\bsingle\s+sign[\s-]?on\b/gi, "single sign-on"],
  [/\bmulti[\s-]factor\b/gi, "multi-factor"],
  [/\bticket\s+granting\b/gi, "ticket-granting"],
  [/\bpass\s+the\s+hash\b(?!\s+brown\b)/gi, "pass-the-hash"],
  [/\bpass\s+the\s+ticket\b/gi, "pass-the-ticket"],
  [/\bcyber\s+ark\b/gi, "CyberArk"],
  [/\bmicro\s+soft\s+sentinel\b/gi, "Microsoft Sentinel"],
  [/\bqualys\b/gi, "Qualys"],
  [/\bnessus\b/gi, "Nessus"],
  [/\bsplunk\b/gi, "Splunk"],
  [/\bfifth\s+third\b/gi, "Fifth Third"],
  // Whisper's repeated garbles of interview terms. A nearby English word is left alone.
  [/\bcooper\s+nett(?:y|ie)s\b/gi, "Kubernetes"],
  [/\bkuber\s*netes\b/gi, "Kubernetes"],
  [/\bkube\s*netes\b/gi, "Kubernetes"],
  [/\bkubernet(?:ee|i)s\b/gi, "Kubernetes"],
  [/\bkubernetes\b/gi, "Kubernetes"],
  [/\b(?:pee\s+kay\s+eye|p\.?\s*k\.?\s*i\.?)\b/gi, "PKI"],
  [/\bterra\s+form\b/gi, "Terraform"],
  [/\bterror\s+form\b/gi, "Terraform"],
  [/\bteraform\b/gi, "Terraform"],
  [/\bterraform\b/gi, "Terraform"],
  [/\bstart\s+method\b/gi, "STAR method"],
  [/\bs\.?\s*t\.?\s*a\.?\s*r\.?\s+method\b/gi, "STAR method"],
  [/\bstar\s+method\b/gi, "STAR method"],
  // Mishearings found on 29 Oct 2026 (voice slice). Each one is anchored to its domain words.
  [/\bsail\s+point\b/gi, "SailPoint"],
  [/(?<=\b(?:did|does|with|into|using|use|used|like|from|vs|versus|deploy|deployed|implemented|chose|picked|cyberark|our|the|a)\s+)beyond\s+trust\b|\bbeyond\s+trust(?=\s+(?:pam|password|privileged|remote|vault|endpoint|suite|platform|deployment|rollout|compare[sd]?)\b)/gi, "BeyondTrust"],   // only next to tool words, so "went beyond trust" stays
  [/\bhashi\s+corp\b/gi, "HashiCorp"],
  [/\bz\s+scaler\b/gi, "Zscaler"],
  [/\bcyber\s*arch\b/gi, "CyberArk"],
  [/\bmy\s+tree\s+attack\b/gi, "MITRE ATT&CK"],
  [/\bresid(?:ue)?\s+jewel\s+risk\b/gi, "residual risk"],
  [/\bdev\s+sec\s+ops\b/gi, "DevSecOps"],
  [/\bsoc\s+(?:two|2)\b|\bsock\s+(?:two|2)(?=\s+(?:audits?|reports?|type|compliance|controls?|certification|readiness|attestation|program|framework)\b)/gi, "SOC 2"],   // "a sock two days ago" stays
  [/\bnist\s+eight\s+hundred\s+(?:dash\s+)?fifty[\s-]three\b/gi, "NIST 800-53"],
  [/\b(?:in\s*tra|entra)\s+i\.?\s*d\b/gi, "Entra ID"],
  [/\bpost\s+gres\s*q\s*l\b/gi, "PostgreSQL"],
  [/\bjay\s+son\s+web\s+tokens?\b/gi, "JSON Web Token"],
  [/\bo\s+i\s+d\s+c\b/gi, "OIDC"],
  [/\bsam\s+el\s+(assertion|token|response|sso|federation)\b/gi, "SAML $1"],
  [/\bans\s+ible\b/gi, "Ansible"],
  [/(?<=\b(?:use|used|using|in|on|with|from|our|into|self-hosted|hosted|via|of)\s+)git\s+lab\b|\bgit\s+lab(?=\s+(?:runners?|ci|pipelines?|repos?|repository|server|instance|issues?|merge|projects?)\b)/gi, "GitLab"],   // "go git lab results" stays
  [/\b(?:get|git)\s+hub\s+(actions|repo|repository|workflow)\b/gi, "GitHub $1"],
  [/\bec\s+two\s+(instances?)\b/gi, "EC2 $1"],
  [/\bs\s+three\s+(buckets?)\b/gi, "S3 $1"],
  [/\bdocker\s+file\b/gi, "Dockerfile"],
]

/** Repair a heard line. Ordinary sentences, and a line already repaired, come back unchanged. */
export function repairDictation(text: string): string {
  let next = String(text || "")
  for (const [pattern, replacement] of REPAIRS) next = next.replace(pattern, replacement as string)
  return next
}
