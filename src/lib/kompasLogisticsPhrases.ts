// Verbatim copy of Dossier's no-logistics phrase list and bannedLogistics (dossier-engine-master 79f91b38,
// src/lib/dossierBlueprint.ts). scripts/tests/kompas-lens-logistics.test.mjs fails if it drifts from Dossier's copy.
// When both land, keep one file and import it from the other.
// Eshwar's rule (29 Oct 2026): no logistics anywhere in a dossier or answer. Phrases, not bare words, so
// "address the root cause" or "relocated the pipeline" are not caught.
const LOGISTICS: RegExp[] = [
  /\b(?:visa|h-?1b|green\s*card|sponsorship|sponsor\s+(?:me|my|a\s+visa)|work\s+authori[sz]ation|authori[sz]ed\s+to\s+work|citizen(?:ship)?|work\s+permit|\bOPT\b|EAD)\b/gi,
  /\b(?:salary|compensation|pay\s+(?:rate|range|expectations?)|hourly\s+rate|bill\s+rate|rate\s+expectations?|per\s+hour)\b/gi,
  /\b(?:relocat(?:e|ion|ing)\b(?!\s+(?:the|a|an|our|my|its)\s+(?:log|pipeline|data|bucket|service|server|workload|database)))/gi,
  /\b(?:current(?:ly)?\s+(?:location|located|based)|where\s+(?:are\s+you|I\s+am|I'm)\s+(?:located|based)|local\s+to|commut(?:e|ing)|home\s+address|mailing\s+address|street\s+address)\b/gi,
  /\b(?:start\s+date|notice\s+period|available\s+to\s+start|when\s+(?:could|can|would)\s+you\s+start)\b/gi,
  /\b(?:on-?site|in-?office|in\s+office|hybrid|(?:fully\s+|not\s+)?remote\s*(?:role|position|work|job)?(?=\W)|work\s+from\s+home|days?\s+(?:a|per|each)\s+week|working\s+model|return\s+to\s+office)\b/gi,
  /\b(?:contract\s+(?:length|term|duration|terms)|conversion\s+to\s+(?:full-?time|FTE|perm)|contract-to-hire|w-?2|c2c|1099)\b/gi,
  /^#{1,4}\s.*\blogistics\b/gim,
]
export function bannedLogistics(text: string): string[] {
  const out: string[] = []
  for (const re of LOGISTICS) for (const m of String(text || "").matchAll(new RegExp(re.source, re.flags))) out.push(m[0].trim())
  return out
}
