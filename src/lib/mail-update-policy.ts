export type InboxUpdate={id:string;account:string;thread:string;message:string;from:string;subject:string;preview:string;at:number;observedAt:number;initial:boolean}
export type UpdatePreferences={enabled:boolean;mobile:boolean;ending:string;accounts:string[];onlyImportant:boolean;since:number}
export const defaultUpdatePreferences:UpdatePreferences={enabled:false,mobile:false,ending:'',accounts:[],onlyImportant:true,since:0}
export function validUpdatePreferences(v:unknown):v is UpdatePreferences{const p=v as UpdatePreferences;return !!p&&typeof p.enabled==='boolean'&&typeof p.mobile==='boolean'&&typeof p.onlyImportant==='boolean'&&typeof p.ending==='string'&&/^\d{0,4}$/.test(p.ending)&&Array.isArray(p.accounts)&&p.accounts.length<=4&&new Set(p.accounts).size===p.accounts.length&&p.accounts.every(a=>typeof a==='string'&&a.length<200&&/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(a))&&Number.isFinite(p.since)&&p.since>=0}
export function eligibleMobile(e:InboxUpdate,p:UpdatePreferences,important:boolean,now=Date.now()){return p.enabled&&p.mobile&&!e.initial&&e.at>=p.since&&e.at<=now&&now-e.at<86400000&&p.accounts.includes(e.account)&&(!p.onlyImportant||important)}

export type SenderNotifyRule = { account: string; email: string; mode: 'always' | 'never' }
export function senderNotifyMode(rules: unknown, account: string, email: string): 'always' | 'never' | null {
  if (!Array.isArray(rules)) return null
  const matches = rules.filter(r => r && typeof r.account === 'string' && typeof r.email === 'string' && r.account.toLowerCase() === account.toLowerCase() && r.email.toLowerCase() === email.toLowerCase())
  if (matches.some(r => r.mode === 'never')) return 'never'
  return matches.some(r => r.mode === 'always') ? 'always' : null
}
