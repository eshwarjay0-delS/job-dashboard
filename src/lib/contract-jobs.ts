export type ContractType = 'W2' | 'C2C' | '1099' | 'C2H' | 'Temporary' | 'Contract'
/** Employment evidence, not guesses from company names or ordinary W2 payroll. */
export function contractTypes(text:string, employmentType=''):ContractType[]{
 const normalize=(value:string)=>String(value||'').toLowerCase().replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim()
 const stripNegations=(value:string)=>value
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?(?:c2h|contract[ -]to[ -](?:hire|perm(?:anent)?)|right[ -]to[ -]hire)\b/gi,' ')
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?(?:c2c|corp[ -]to[ -]corp)\b/gi,' ')
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?1099\b/gi,' ')
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?w[ -]?2\b/gi,' ')
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?temporary\b/gi,' ')
  .replace(/\b(?:no|not|without|never)\s+(?:a\s+)?(?:contract|contractor|contracting)(?:\s+(?:role|position|job|assignment|engagement|opportunity|opening|basis|employment))?\b/gi,' ')
 const t=stripNegations(normalize(text)), et=stripNegations(normalize(employmentType)), combined=t+' '+et
 const out:ContractType[]=[]
 const hasC2C=/\b(?:c2c|corp[ -]to[ -]corp)\b/.test(combined)
 const has1099=/\b1099\b/.test(combined)
 const hasC2H=/\b(?:c2h|contract[ -]to[ -](?:hire|perm(?:anent)?)|right[ -]to[ -]hire)\b/.test(combined)
 const hasTemporary=/\btemp[ -]to[ -]hire\b/.test(combined)||/\btemporary\b/.test(et)||/\btemporary\s+(?:role|position|job|assignment|contract)\b|\b(?:role|position|job|assignment)\s+(?:is\s+)?temporary\b/.test(t)
 const hasW2=/\bw[ -]?2\b/.test(combined)
 // A structured employmentType label is authoritative. Free-text contract words need employment context.
 const hasContractLabel=/\bcontract(?:or|ing)?\b/.test(et)
 const hasContractContext=/\b(?:contract|contractor|contracting)\s+(?:role|position|job|assignment|engagement|opportunity|opening|basis|employment|work)\b|\b(?:role|position|job|assignment|engagement|opportunity|opening)\s+(?:is|as|on)\s+(?:a\s+)?contract\b|\b(?:full|part)[ -]time\s+contract\b|\bfixed[ -]term\s+contract\b|\bw[ -]?2\s+contract\b|\bindependent\s+contractor\b|\bcontractor\s+(?:for|on)\s+(?:a\s+)?(?:\d+|one|two|three|six|twelve)\s+(?:week|month|year)s?\b|\bcontract\s+for\s+(?:a\s+)?(?:\d+|one|two|three|six|twelve)\s+(?:week|month|year)s?\b|\b(?:\d+|one|two|three|six|twelve)[ -](?:week|month|year)\s+contract\b/.test(t)
 const hasContract=hasContractLabel||hasContractContext||hasC2C||has1099||hasC2H||hasTemporary
 if(hasC2C)out.push('C2C')
 if(has1099)out.push('1099')
 if(hasC2H)out.push('C2H')
 if(hasTemporary)out.push('Temporary')
 if(hasContract&&hasW2)out.unshift('W2')
 if(hasContract&&!out.length)out.push('Contract')
 return out
}
export function applicationUrl(value:string):string|null{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}

/**
 * The owner's standing search preference excludes clearance roles. Match only
 * explicit job requirements, not ordinary prose about secure systems or a
 * candidate saying they have no clearance. “Not required initially” is still
 * a clearance role because the qualification is merely deferred.
 */
export function requiresSecurityClearance(text:string):boolean{
 const t=(text||'').toLowerCase().replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ')
 if(!/clearance|public trust|ts\s*[\/-]\s*sci|top secret|\bsc[- ]cleared\b|\bdv[- ]cleared\b/.test(t))return false

 // Remove only complete, unconditional no-clearance statements. Any separate
 // requirement in the same posting remains available to the checks below.
 const scan=t
  .replace(/\bno (?:active |current )?(?:security )?clearance (?:is )?(?:required|needed)\b/g,' ')
  .replace(/\b(?:security )?clearance (?:is )?not (?:required|needed)(?!\s+(?:initially|at first|at the start))\b/g,' ')
  .replace(/\bdoes not require\b.{0,30}\bclearance\b/g,' ')

 const required=[
  /\b(?:active|current|existing)\b.{0,35}\b(?:security )?clearance\b/,
  /\b(?:must|required|mandatory|need(?:ed)?|preferred|eligible|eligibility|ability|able|willing)\b.{0,70}\b(?:security )?(?:clearance|public trust)\b/,
  /\b(?:clearance|public trust)\b.{0,70}\b(?:required|mandatory|must|needed|preferred|eligible|eligibility|obtain|maintain|sponsor(?:ship)?)\b/,
  /\b(?:obtain|maintain|hold|possess)\b.{0,40}\b(?:security )?(?:clearance|public trust)\b/,
  /\bclearance sponsorship\b|\b(?:secret|top secret|dod|doe) clearance\b|\bts\s*[\/-]\s*sci\b|\btop secret\b|\bsc[- ]cleared\b|\bdv[- ]cleared\b|\bpublic trust\b/,
 ]
 if(required.some(re=>re.test(scan)))return true
 return false
}
