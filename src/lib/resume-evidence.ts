/** Keep explicit experience ahead of potentially lengthy pasted job requirements.
 * Downstream enrichment has a bounded context; the JD is also supplied separately.
 */
export function candidateEvidenceInput(jd: string, confirmations: readonly string[]): string {
  return [
    ...(confirmations.length ? [`EXPLICIT CANDIDATE INPUT:\n${confirmations.join("\n")}`] : []),
    "SOURCE-FACT CONFLICT RULES:",
    "- Treat the uploaded resume as candidate-provided evidence, not proof that every statement is current or accurate.",
    "- If explicit candidate input conflicts with resume education, employment dates, employer, tenure or credential status, do not merge, average or silently choose; mark the fact unresolved and request correction before using it.",
    "- A credential described as pursuing, in progress, planned or studying for is not earned.",
    "- Job-description requirements, including years of experience and preferred credentials or tools, are never candidate evidence; only explicit candidate confirmations can support a skill.",
    "- An explicitly confirmed skill may be mapped naturally into relevant existing project bullets across the selected resume's roles, including earlier roles, even when the original bullet does not name the tool. The confirmation supports the skill, not a new employer, project, title, date, location, contact, metric, credential or unsupported project detail.",
    "- Apply confirmations only to this request's selected account, resume and JD; never borrow another account's resume or profile.",
    `JOB DESCRIPTION (target requirements, not candidate evidence):\n${jd}`,
  ].join("\n\n")
}

/** A blanket confirmation can support the complete supplied requirement set, but a
 * formatting instruction such as "add all keywords" cannot. Keep this deliberately
 * narrow: the statement must explicitly attribute experience to the candidate. */
const UNCERTAIN_CONFIRMATION = /\b(?:maybe|might|may|possibly|perhaps|probably|think|believe|guess|unsure|uncertain|not\s+sure|not\s+certain|if\s+i\s+recall|as\s+far\s+as\s+i\s+remember|iirc|sort\s+of|kind\s+of|cannot\s+recall|can't\s+recall)\b/i

export function explicitlyConfirmsAllRequirements(statements: readonly string[]): boolean {
  const text = statements.filter(Boolean).join("\n").replace(/\s+/g, " ").toLowerCase()
  if (!text || /\b(?:except|excluding|not|never|no experience|without)\b/.test(text) || UNCERTAIN_CONFIRMATION.test(text) || text.includes("?")) return false
  return [
    /\bi\s+(?:have|possess)\s+experience\s+(?:with|in|using)\s+(?:all|every)\s+(?:(?:of\s+)?them|(?:(?:of\s+)?(?:these|those|the|listed|required(?:\s+and\s+preferred)?|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies)))\b/,
    /\bmy\s+experience\s+(?:includes|covers)\s+(?:all|every)\s+(?:(?:of\s+)?(?:these|those|the|listed|required|preferred)\s+)?(?:skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/,
    /\bi\s+(?:have|possess)\s+(?:all|every)\s+(?:listed|required|preferred)\s+(?:skills?|requirements?|tools?|technolog(?:y|ies))\b/,
  ].some(pattern => pattern.test(text))
}

/** Only explicit candidate assertions can expand skill evidence. A confirmed skill may be
 * mapped into a relevant existing project bullet across roles, but this parser never supplies
 * an employer, project, date, title, location, contact or metric. Naming a tool in an editing
 * instruction, a question or a negation is not confirmation. */
const CONFIRMATION_IGNORED_TERMS = new Set([
  "i", "my", "have", "has", "had", "possess", "experience", "skills", "skill", "background", "confirmed",
  "used", "using", "implemented", "deployed", "managed", "tested", "built", "conducted", "performed", "worked",
  "includes", "include", "covers", "cover", "all", "every", "them", "these", "those", "listed", "required", "preferred",
  "requirements", "requirement", "keywords", "keyword", "tools", "tool", "technologies", "technology",
  "except", "excluding", "but", "however", "not", "never", "without", "missing", "no", "do", "does", "did",
  "dont", "doesnt", "didnt", "cannot", "cant", "is", "are", "was", "were", "be", "with", "in", "on", "at", "for",
  "and", "or", "of", "to", "the", "a", "an", "any", "their", "its", "it", "more", "less", "only", "very", "strong",
  "production", "project", "projects", "role", "roles", "work", "security", "monitoring", "operations", "data",
  "service", "services", "system", "systems", "team", "teams", "user", "users", "admin", "access", "management",
  "application", "applications", "cloud", "network", "audit", "risk", "compliance", "process", "processes",
  "development", "engineering", "platform", "platforms",
])
const confirmationTerms = (value: string) => (value.toLowerCase().match(/[a-z0-9][a-z0-9.+#/-]*/g) || [])
  .filter(term => term.length > 1 && !CONFIRMATION_IGNORED_TERMS.has(term))

const NON_CANDIDATE_SUBJECT = String.raw`(?:my|our|their)\s+(?:team|teams|colleague|colleagues|coworker|coworkers|manager|managers|client|clients|customer|customers|organization|organizations|company|companies|department|departments|group|groups|partner|partners|vendor|vendors|project|projects|staff|employees|employer|employers|consultant|consultants|contractor|contractors|subcontractor|subcontractors)\b|(?:the|a|an)\s+(?:team|teams|colleague|coworker|manager|client|customer|organization|company|department|group|partner|vendor|project|staff|employees|employer|consultant|contractor|subcontractor)\b|(?:we|they|someone|somebody|anyone|anybody|others)\b|(?:another|other)\s+(?:person|people|teams?|groups?|companies?|organizations?|vendors?|contractors?|subcontractors?|consultants?|partners?|clients?|customers?|colleagues?|coworkers?|managers?|employees?)\b|(?:external|outside|third[-\s]?party)\s+(?:teams?|groups?|companies?|organizations?|vendors?|contractors?|subcontractors?|consultants?|partners?|clients?|customers?|employees?|staff)\b|(?:contractors?|subcontractors?|consultants?|vendors?|partners?|teams?|groups?|organizations?|companies?|employees?|staff|colleagues?|coworkers?|managers?|clients?|customers?)\b|(?:client|customer|organization|company|team|colleague|coworker|manager|department|group|partner|vendor|project|staff|employees|employer|consultant|contractor|subcontractor|others|someone|somebody|anyone|anybody)\b`
const NON_CANDIDATE_PASSIVE = String.raw`(?:[a-z][a-z0-9.+#/-]*\s+)?(?:was|were|is|are|has been|have been|had been)\s+(?:used|managed|deployed|implemented|configured|maintained|operated|tested|built|developed|supported|administered|performed|conducted|provided|created|delivered|handled)\s+(?:by|for|with)\s+(?:(?:my|the|our|their)\s+(?:(?:external|outside|third[-\s]?party)\s+)?(?:team|teams|colleague|colleagues|coworker|coworkers|manager|managers|client|clients|customer|customers|organization|organizations|company|companies|department|departments|group|groups|partner|partners|vendor|vendors|project|projects|staff|employees|employer|employers|consultant|consultants|contractor|contractors|subcontractor|subcontractors)|others|someone\s+else|somebody\s+else|another\s+(?:person|team|group|company|organization|vendor|contractor|subcontractor|partner|client|customer)|other\s+(?:people|teams?|groups?|companies|organizations|vendors?|contractors?|subcontractors?|partners?|clients?|customers?)|(?:a|an|the)\s+(?:external|outside|third[-\s]?party)\s+(?:team|group|company|organization|vendor|contractor|subcontractor|partner|client|customer)|(?:a|an|the)\s+(?:vendor|contractor|subcontractor|consultant|partner|client|customer)|(?:external|outside|third[-\s]?party)\s+(?:teams?|groups?|companies?|organizations?|vendors?|contractors?|subcontractors?|consultants?|partners?|clients?|customers?)|(?:contractors?|subcontractors?|consultants?|vendors?|clients?|customers?|partners?|teams?|groups?|organizations?|companies?|employees?|staff|colleagues?|coworkers?|managers?))\b`
const NON_CANDIDATE_TEAM_SUBJECT = String.raw`(?:(?:my|our|their|the|a|an)\s+)?(?:[a-z][a-z0-9.+#/-]*\s+){0,3}teams?\b`
const NON_CANDIDATE_TEAM_PASSIVE = String.raw`(?:[a-z][a-z0-9.+#/-]*\s+)?(?:was|were|is|are|has been|have been|had been)\s+(?:used|managed|deployed|implemented|configured|maintained|operated|tested|built|developed|supported|administered|performed|conducted|provided|created|delivered|handled)\s+(?:by|for|with)\s+${NON_CANDIDATE_TEAM_SUBJECT}`
const NON_CANDIDATE_EXTRA_ACTOR = String.raw`(?:people\\s+(?:from|at|with)\\s+(?:(?:a|an|the)\\s+)?(?:(?:external|outside|third[-\\s]?party)\\s+)?(?:vendors?|contractors?|subcontractors?|consultants?|partners?|clients?|customers?|teams?|groups?|companies?|organizations?)\\b|(?:a|an|the)\\s+(?:soc|security\\s+operations(?:\\s+(?:center|centre|team))?)\\b`
const NON_CANDIDATE_EXTRA_PASSIVE = String.raw`(?:[a-z][a-z0-9.+#/-]*\\s+)?(?:was|were|is|are|has been|have been|had been)\\s+(?:used|managed|deployed|implemented|configured|maintained|operated|tested|built|developed|supported|administered|performed|conducted|provided|created|delivered|handled)\\s+(?:by|for|with)\\s+\\$\{NON_CANDIDATE_EXTRA_ACTOR\}`
const splitNonCandidateAttribution = (line: string): string[] => line
  .split(new RegExp(String.raw`(?:,\\s*|\\b(?:and\\s+then|or\\s+then|and|or|while|whereas|along with|then)\\s+)(?=\\$\{NON_CANDIDATE_SUBJECT\}|\\$\{NON_CANDIDATE_PASSIVE\}|\\$\{NON_CANDIDATE_TEAM_SUBJECT\}|\\$\{NON_CANDIDATE_TEAM_PASSIVE\}|\\$\{NON_CANDIDATE_EXTRA_ACTOR\}|\\$\{NON_CANDIDATE_EXTRA_PASSIVE\})`, "i"))
  .map(part => part.replace(/[ ,\\s]+$/, "").trim())
export function confirmedCandidateStatements(statements: readonly string[]): string[] {
  return statements.flatMap(statement => statement.split(/[\n;]+|[.!](?=\s|$)/)).flatMap(raw => splitNonCandidateAttribution(raw)).flatMap(raw => {
    const line = raw.trim()
    if (!line || raw.includes("?") || UNCERTAIN_CONFIRMATION.test(line)) return []
    if (!/^(?:i\s+(?:(?:have|possess)\b|(?:personally\s+)?(?:used|implemented|deployed|managed|tested|built|conducted|performed|worked)\b)|my\s+(?:experience|skills|background)\b|(?:confirmed experience|confirmed skills)\s*:)/i.test(line)) return []
    // Reject negative assertions before treating a "my ..." sentence as positive evidence.
    // Positive contrast is safe only before its exception (e.g. AWS, but not GCP).
    const negativeClaim = /^(?:my\s+(?:experience|skills|background)\s+(?:lack(?:s|ing)?|(?:is|are)\s+missing|missing|(?:do|does|did)\s+not|don't|doesn't|didn't|cannot|can't|never|isn't|aren't|is\s+not|are\s+not|has\s+no|have\s+no|no)|my\s+experience\s+(?:includes?|covers)\s+no|(?:confirmed\s+(?:skills|experience)\s*:\s*)(?:no|not|never|without|lack(?:s|ing)?|(?:is|are)\s+missing|missing|don't|doesn't|didn't|cannot|can't))\b/i
    if (negativeClaim.test(line) || /^i\s+(?:(?:have|possess)\s+(?:no|not|never|without)|(?:do|does|did)\s+not\s+(?:have|possess)|don't|doesn't|didn't|haven't|cannot|can't)\b/i.test(line)) return []
    const hasBlanketConfirmation = /\b(?:all|every)\b/i.test(line) && /\b(?:them|skills?|requirements?|keywords?|tools?|technolog(?:y|ies))\b/i.test(line)
    const exception = line.match(/\b(?:except|excluding|but|however|not|never|without|no|lack(?:s|ing)?|missing|don't|doesn't|didn't|haven't|hasn't|can't|cannot|won't|isn't|aren't|wasn't|weren't|shouldn't|wouldn't|mustn't)\b/i)
    // A blanket claim with an exception is not blanket evidence. Also reject a
    // self-contradictory list that names the same skill on both sides of its exception.
    if (hasBlanketConfirmation && exception) return []
    const positive = exception ? line.slice(0, exception.index).trim().replace(/(?:,|\b(?:and|or))\s*$/i, "").trim() : line
    if (exception && positive) {
      const supported = new Set(confirmationTerms(positive))
      const excluded = confirmationTerms(line.slice(exception.index! + exception[0].length))
      if (excluded.some(term => supported.has(term))) return []
    }
    return positive ? [positive] : []
  })
}

/** Return only JD terms supported by this specific role's original bullets and
 * still missing from its current bullets. A globally missing term from another
 * role must never be copied into this role's experience. */
export function missingRoleEvidenceTerms(
  sourceTerms: ReadonlySet<string>,
  currentTerms: ReadonlySet<string>,
  requiredTerms: readonly string[],
): string[] {
  const candidates = [...new Set([...requiredTerms, ...sourceTerms])]
  return candidates.filter(term => sourceTerms.has(term) && !currentTerms.has(term))
}


const CONFIRMED_SKILL_CONTEXTS: { skill: RegExp; context: RegExp }[] = [
  {
    // CyberArk EPM is endpoint privilege management. Generic CRM administration,
    // access reviews or compliance audits alone are not evidence of that project context.
    skill: /\bcyberark(?:\s+epm)?\b/i,
    context: /\b(?:endpoint(?:s)?|local admin(?:istrator)?|application control|software restriction|application allowlist|application greylist|windows hardening)\b/i,
  },
  {
    skill: /\b(?:splunk|siem|sentinel|qradar|arcsight|logrhythm)\b/i,
    context: /\b(?:logs?|events?|telemetry|detections?|alerts?|monitoring|correlations?|threats?|incidents?|soc|security operations|security monitoring)\b/i,
  },
  {
    skill: /\b(?:defender|crowdstrike|sentinelone|tanium|edr|xdr)\b/i,
    context: /\b(?:endpoint|host|device|agent|edr|xdr|malware|threat|isolation|containment|telemetry|detection|incident|cloud security|cloud posture|workload protection)\b/i,
  },
  {
    skill: /\b(?:qualys|nessus|tenable|openvas|amazon inspector)\b/i,
    context: /\b(?:vulnerability|scan|finding|patch|remediation|exposure|asset)\b/i,
  },
  {
    skill: /\brapid7\b/i,
    context: /\b(?:vulnerability|scan|finding|patch|remediation|exposure|asset|log|event|telemetry|detection|alert|monitoring|correlation|threat|incident|soc|security operations)\b/i,
  },
  {
    skill: /\b(?:burp|owasp zap|zaproxy|snyk|sonarqube|fortify|appscan)\b/i,
    context: /\b(?:application|api|web|code|sdlc|sast|dast|security testing|penetration test|pentest)\b/i,
  },
  {
    skill: /\b(?:zscaler|palo alto|check point|fortinet|cisco asa|juniper)\b/i,
    context: /\b(?:network|firewall|traffic|segmentation|proxy|vpn|perimeter|routing|packet)\b/i,
  },
  {
    skill: /\b(?:dlp|proofpoint|tessian|mimecast|abnormal security)\b/i,
    context: /\b(?:data loss|exfiltration|sensitive data|information protection|email security|phishing|quarantine)\b/i,
  },
  {
    skill: /\b(?:okta|sailpoint|forgerock|pingfederate|ping identity|active directory|entra id|iam|pam|sso|mfa)\b/i,
    context: /\b(?:identity|access|authentication|authorization|directory|provisioning|privilege|administrator|sso|mfa|iam|account review|account access|access review|user account|user provisioning)\b/i,
  },
  {
    skill: /\b(?:aws|amazon web services|azure|gcp|google cloud|kubernetes|docker|terraform|cloudformation|ansible)\b/i,
    context: /\b(?:cloud|infrastructure|container(?:ized)?|docker|kubernetes|server(?:less)?|hosting|orchestration|terraform|cloudformation|ansible|vpc|ec2|s3|rds|lambda|cloudwatch|ci\/cd)\b/i,
  },
  {
    skill: /\b(?:canton|solana|solidity|hyperledger|dlt|blockchain|distributed ledger)\b/i,
    context: /\b(?:blockchain|distributed ledger|ledger|transaction|settlement|token|smart contract|custody|digital asset|chain|payments)\b/i,
  },
  {
    skill: /\b(?:snowflake|sql|tableau|power bi|spark|kafka|databricks|redshift|bigquery|pandas)\b/i,
    context: /\b(?:data|database|analytics|report|dashboard|metrics|etl|warehouse|query|stream|event|pipeline|business intelligence)\b/i,
  },
  {
    skill: /\b(?:salesforce|pardot|servicenow|service cloud|sales cloud|dynamics 365)\b/i,
    context: /\b(?:crm|sales|customer|service|marketing|case|workflow|account|lead|opportunity|ticket|support|campaign)\b/i,
  },
  {
    skill: /\b(?:python|java|javascript|typescript|golang|rust|c\+\+|c#|ruby|bash|powershell)\b/i,
    context: /\b(?:software|application|script|automation|development|integration|api|pipeline|test|code|etl|database|tooling|scripting|programming)\b/i,
  },
  {
    skill: /\b(?:nist|iso\s*27001|sox|pci\s*dss|soc\s*2|cobit|fedramp|hipaa)\b/i,
    context: /\b(?:audit|compliance|control|risk|governance|policy|assessment|regulatory|evidence|remediation|assurance)\b/i,
  },
]

/** A confirmed skill is cross-role evidence only where the original bullet's project
 * context fits that skill family. Unknown terms need direct source support. */
function confirmedSkillFitsBullet(
  term: string,
  sourceBullet: string,
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
): boolean {
  if (cover(sourceBullet, [term]).has(term)) return true
  const family = CONFIRMED_SKILL_CONTEXTS.find(group => group.skill.test(term))
  return Boolean(family && family.context.test(sourceBullet))
}

/** Restore an edited experience bullet when it introduces a JD term unsupported by
 * that role's original bullets and not explicitly confirmed by the candidate. Explicit
 * confirmations are the owner-approved cross-role exception; the existing bullet/project
 * frame must still be preserved. */
export function restoreUnsupportedRoleEdits<T extends { idx: number; text: string }>(
  edits: readonly T[],
  roles: readonly { bullets: readonly { idx: number; text: string }[] }[],
  terms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
  confirmedTerms: ReadonlySet<string> = new Set(),
): { edits: T[]; reverted: number; blockedTerms: string[] } {
  const sourceByIdx = new Map<number, string>()
  const allowedByIdx = new Map<number, ReadonlySet<string>>()
  for (const role of roles) {
    for (const bullet of role.bullets) {
      const allowed = new Set([
        ...cover(bullet.text, terms),
        ...[...confirmedTerms].filter(term => confirmedSkillFitsBullet(term, bullet.text, cover)),
      ])
      sourceByIdx.set(bullet.idx, bullet.text)
      allowedByIdx.set(bullet.idx, allowed)
    }
  }
  let reverted = 0
  const blocked = new Set<string>()
  const guarded = edits.map(edit => {
    const source = sourceByIdx.get(edit.idx)
    const allowed = allowedByIdx.get(edit.idx)
    if (source === undefined || !allowed) return { ...edit }
    const unsupported = [...cover(edit.text, terms)].filter(term => !allowed.has(term))
    if (!unsupported.length) return { ...edit }
    reverted++
    unsupported.forEach(term => blocked.add(term))
    return { ...edit, text: source }
  })
  return { edits: guarded, reverted, blockedTerms: [...blocked] }
}


/** Candidate-confirmed skills may be gap candidates only where the existing role
 * bullets have a matching project context. This remains limited to the named skill. */
export function roleScopedConfirmedSkillTerms(
  bullets: readonly { text: string }[],
  requiredTerms: string[],
  confirmedTerms: readonly string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
): string[] {
  const sourceText = bullets.map(b => b.text).join("\n")
  return [...new Set(confirmedTerms.filter(term =>
    requiredTerms.includes(term) && confirmedSkillFitsBullet(term, sourceText, cover),
  ))]
}

/** Return only missing JD terms supported by this role's source bullets or
 * explicit confirmed skills whose project context fits this role. */
export function roleScopedMissingTerms(
  roles: readonly { bullets: readonly { idx: number; text: string }[] }[],
  current: readonly { idx: number; text: string }[],
  requiredTerms: string[],
  cover: (text: string, terms: string[]) => ReadonlySet<string>,
  confirmedTerms: readonly string[] = [],
): { roleIndex: number; terms: string[] }[] {
  const currentByIdx = new Map(current.map(b => [b.idx, b.text]))
  return roles.flatMap((role, roleIndex) => {
    const sourceText = role.bullets.map(b => b.text).join("\n")
    const currentText = role.bullets.map(b => currentByIdx.get(b.idx) || b.text).join("\n")
    const sourceTerms = cover(sourceText, requiredTerms)
    const confirmedRelevant = roleScopedConfirmedSkillTerms(role.bullets, requiredTerms, confirmedTerms, cover)
    const eligibleTerms = new Set([...sourceTerms, ...confirmedRelevant])
    const currentTerms = cover(currentText, requiredTerms)
    const terms = missingRoleEvidenceTerms(eligibleTerms, currentTerms, requiredTerms)
    return terms.length ? [{ roleIndex, terms }] : []
  })
}
