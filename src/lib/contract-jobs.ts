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
