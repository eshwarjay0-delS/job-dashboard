/**
 * The interviewer's request, not keyword overlap, decides what Kompas answers.
 *
 * Pure source-side question boundary extraction. This does not infer hidden
 * reasoning or turn user/JD background into evidence. A model still interprets
 * meaning; this module only keeps setup language out of the central ask.
 */
export type QuestionKernel={
  ask: string
  setup: string
  constraints: string[]
  carryOptions: boolean
}
const ASK_HEAD=/\b(?:any questions|what|which|who|why|how|where|when|can you|could you|would you|will you|do you|does|did you|have you|are you|is there|tell me|describe|explain|give me|walk me through|share an example|highlight for me|talk about)\b/i
const ASKER=/^\s*(?:(?:okay|alright|all right|yeah|so|now|well|and|then|uh|um|like|you know)[,.\s]+){0,6}(?:any questions|what|which|who|why|how|where|when|can|could|would|will|do|does|did|have|has|are|is|tell|describe|explain|give|walk|share|highlight|talk)\b/i
const SCOPED_CLAUSE=/(?:[;,]\s*|\b(?:so|and|then|but|now)\s*,?\s*|\b(?:my|the) (?:real |next )?question is\s*)(?=(?:what|which|who|why|how|when|can|could|would|do|have|tell me|describe|explain|give me|walk me through|highlight for me)\b)/ig
const RHETORICAL=/^(?:right|okay|yeah|you know|make sense|does that make sense|got it)\??$/i
const OPTION_REFERENCE=/\b(?:which (?:of (?:those|these|them)|one)|between (?:those|these|them)|of (?:these|those) (?:two|three|options)|which (?:framework|tool|option) (?:is|would be) (?:better|stronger|more relevant)|either one)\b/i
const CONSTRAINTS=/\b(?:must|cannot|can't|should not|without|no (?:production )?(?:access|downtime|restart|internet|admin)|only|while|within (?:\d+|the first)|not allowed|critical production|keep (?:it|the service) (?:running|available)|under (?:time|pressure)|first \d+ days|suppose|imagine|assume|given|consider)\b/i

function cleaned(value:string):string{
 return String(value||"").replace(/\s+/g," ").trim()
}
function removeFillerHead(s:string):string{
 return s.replace(/^\s*(?:(?:so|well|okay|alright|all right|yeah|now|um|uh)[,\s]+){1,5}/i,"").trim()
}
function sentenceParts(value:string):string[]{
 // Keep NIST SP 800-53, "e.g.", dotted software versions etc. as text.
 // Only split when a terminal mark is followed by a plausible sentence start.
 return value.split(/(?<=[?!.])\s+(?=[A-Z]|(?:so|what|how|which|why|tell|and|now)\b)/i).filter(Boolean)
}
function isAsk(s:string):boolean{
 const t=removeFillerHead(s).replace(/[?!.]\s*$/,"").trim()
 if(!t||RHETORICAL.test(t))return false
 if(ASKER.test(t))return true
 return /\?\s*$/.test(s)&&ASK_HEAD.test(t)&&!/\b(?:right|okay|yeah)\s*\?\s*$/i.test(s)
}
function lastEmbeddedAsk(s:string):string{
 const parts=Array.from(s.matchAll(SCOPED_CLAUSE))
 for(let j=parts.length-1;j>=0;j--){
  const m=parts[j],after=s.slice((m.index||0)+m[0].length)
  if(isAsk(after)) return removeFillerHead(after)
 }
 return removeFillerHead(s)
}
function getConstraints(setup:string):string[]{
 // This is input from the same speaker's CURRENT turn, not generated history.
 // These conditions may constrain a scenario; they never prove a past action.
 const relevant=sentenceParts(setup).filter(s=>CONSTRAINTS.test(s))
 return relevant.slice(-2).map(s=>s.slice(0,300).trim())
}
export function questionKernel(value:string):QuestionKernel{
 const original=cleaned(value)
 if(!original)return {ask:"",setup:"",constraints:[],carryOptions:false}
 // A hypothetical opening defines the problem itself. Never trim it away
 // merely because it is followed by a short "what would you do?" clause.
 if(/^(?:suppose|imagine|assume|if|given|consider)\b/i.test(original))
  return {ask:original,setup:"",constraints:[],carryOptions:false}
 const sentences=sentenceParts(original)
 let last=-1
 for(let i=0;i<sentences.length;i++){
  const text=sentences[i]
  const embedded=lastEmbeddedAsk(text)
  if(isAsk(embedded))last=i
 }
 if(last<0){
  // Some transcription fragments are requests without terminal punctuation.
  const embedded=lastEmbeddedAsk(original)
  if(isAsk(embedded)&&embedded!==original){
   const begin=original.lastIndexOf(embedded)
   const setup=original.slice(0,begin).trim()
   return {ask:embedded,setup,constraints:getConstraints(setup),carryOptions:OPTION_REFERENCE.test(embedded)}
  }
  return {ask:original,setup:"",constraints:[],carryOptions:false}
 }
 let first=last
 // Retain consecutive explicit sub-questions, e.g. "How was it found? How
 // was it validated?" They are one compound ask, not competing topics.
 while(first>0&&isAsk(lastEmbeddedAsk(sentences[first-1]))&&!RHETORICAL.test(sentences[first-1]))first--
 const firstChosen=lastEmbeddedAsk(sentences[first])
 const leading=sentences[first].endsWith(firstChosen) ? sentences[first].slice(0,-firstChosen.length).trim() : ""
 const ask=sentences.slice(first,last+1).map(lastEmbeddedAsk).join(" ").replace(/\s+(?:right|okay|you know)\s*\?\s*$/i,"").trim()
 const setup=[...sentences.slice(0,first),leading,...sentences.slice(last+1)].filter(Boolean).join(" ").trim()
 return {ask:ask||original,setup,constraints:getConstraints(setup),carryOptions:OPTION_REFERENCE.test(ask)}
}
