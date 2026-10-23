export type ContractType = 'W2' | 'C2C' | '1099' | 'C2H' | 'Temporary' | 'Contract'
/** Employment evidence, not guesses from company names or ordinary W2 payroll. */
export function contractTypes(text:string, employmentType=''):ContractType[]{
 const t=text.toLowerCase(),out:ContractType[]=[]
 if(/\b(?:c2c|corp[ -]to[ -]corp)\b/.test(t)&&!/\b(?:no|not|without)\s+(?:c2c|corp[ -]to[ -]corp)\b/.test(t))out.push('C2C')
 if(/\b1099\b/.test(t)&&!/\b(?:no|not)\s+1099\b/.test(t))out.push('1099')
 if(/\bc2h\b|contract[ -]to[ -]hire|contract[ -]to[ -]permanent/.test(t))out.push('C2H')
 if(/\btemporary\b|\btemp[ -]to[ -]hire\b/.test(t)||/temporary/i.test(employmentType))out.push('Temporary')
 const contract=/\bcontract(?:or|ing)?\b/.test(t)||/contract/i.test(employmentType)||out.length>0
 if(contract&&/\bw[ -]?2\b/.test(t))out.unshift('W2')
 if(contract&&!out.length)out.push('Contract')
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
