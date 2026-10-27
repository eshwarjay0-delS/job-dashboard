/** Channel-independent setup state. Does not authorize access or send messages. */
export type WhatsAppKompas = { mode: 'kompas'; resume?: string; jd?: string; documents: { name: string; text: string }[] }
export type KompasInput = { kind: 'text'; text: string } | { kind: 'document'; role: 'resume' | 'jd' | 'support'; name: string; text: string }
/**
 * Classify pasted setup material independently of upload order. WhatsApp users
 * often paste a JD and then attach Resume.docx, unlike the wizard's wording.
 * Require multiple structural cues to avoid mistaking interview questions for JDs.
 * Return null for ambiguous short text: existing setup prompts still apply.
 */
export function classifyKompasPastedSource(state: WhatsAppKompas, input: string): 'resume' | 'jd' | null {
 const text = input.trim()
 if (!text || (state.resume && state.jd)) return null
 const sample = text.slice(0, 16000)
 if (/^\s*(?:jd|job description|job posting)\s*:/i.test(sample) && !state.jd) return 'jd'
 if (/^\s*(?:resume|curriculum vitae|cv)\s*:/i.test(sample) && !state.resume) return 'resume'
 if (text.length < 120) return null
 const jobHeaders = (sample.match(/^\s*(?:job title|title|organization|position|primary location|location|client|description|required qualifications|qualifications|requirements|responsibilities|must have|nice to have)\s*:/gim) || []).length
 const jobPhrases = (sample.match(/\b(?:job description|must have|required qualifications|responsibilities include|we are seeking|the candidate will|this role will|will be responsible|experience with|local candidates only|application security program)\b/gi) || []).length
 const resumeHeads = (sample.match(/^\s*(?:professional summary|work experience|professional experience|employment history|technical skills|certifications|education|projects|security researcher)\b/gim) || []).length
 const resumeSignals = resumeHeads + (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(sample) ? 1 : 0)
 if (!state.jd && jobHeaders + Math.min(jobPhrases, 3) >= 3 && jobHeaders + jobPhrases > resumeSignals) return 'jd'
 if (!state.resume && resumeSignals >= 3 && jobHeaders < 2) return 'resume'
 return null
}

export function kompasTransition(state: WhatsAppKompas | undefined, input: KompasInput): {
 state?: WhatsAppKompas; action: 'tailor' | 'setup' | 'answer' | 'revert' | 'reject'; prompt?: string; question?: string
} {
 const text = input.kind === 'text' ? input.text.trim() : ''
 if(input.kind==='text' && text.toLowerCase()==='revert') return {action:'revert',prompt:'Back to MFit resume tailoring.'}
 if(input.kind==='text' && text.toLowerCase()==='kompas') return {state:state??{mode:'kompas',documents:[]},action:'setup',prompt:'Send your resume and the job description in either order. You can also attach supporting documents. Send start when ready.'}
 if(!state) return {action:'tailor'}
 const next={...state,documents:[...state.documents]}
 if(input.kind==='document'){
  if(!input.text.trim() || input.text.length>(input.role==='resume'?60000:8000) || (input.role==='support' && (next.documents.length>=10 || next.documents.reduce((n,d)=>n+d.text.length+d.name.length+4,0)+input.text.length+input.name.length+4>8000))) return {state,action:'reject',prompt:'This document is empty or too large. Please send a smaller readable document.'}
  if(input.role==='resume')next.resume=input.text
  else if(input.role==='jd')next.jd=input.text
  else next.documents.push({name:input.name,text:input.text})
  return {state:next,action:'setup',prompt:!next.resume?'Send your resume.':!next.jd?'Send the job description.':'Sources received. Send start when ready.'}
 }
 if(!text)return {state,action:'reject',prompt:'Send a question or a readable document.'}
 if(text.toLowerCase()==='start' && (!next.resume || !next.jd)) return {state,action:'setup',prompt:!next.resume?'Send your resume first.':'Send the job description first.'}
 if(text.length>(!next.resume?60000:!next.jd?8000:4000)) return {state,action:'reject',prompt:'This text is too long. Please send a shorter version.'}
 if(!next.resume){next.resume=text;return {state:next,action:'setup',prompt:'Resume received. Send the job description.'}}
 if(!next.jd){next.jd=text;return {state:next,action:'setup',prompt:'Job description received. Attach supporting documents or send start.'}}
 if(text.toLowerCase()==='start')return {state:next,action:'setup',prompt:'Ready for your questions. Send revert to return to resume tailoring.'}
 return {state:next,action:'answer',question:text}
}
