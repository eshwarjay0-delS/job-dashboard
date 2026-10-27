import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const nodeRequire=createRequire(import.meta.url)
const path="src/lib/whatsapp-voice.ts"
const transpiled=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText
class SpeechError extends Error {
  constructor(code){super(code);this.code=code}
}
const mod={exports:{}}
runInNewContext(transpiled,{
  module:mod,exports:mod.exports,
  require:key=>({
    "@/lib/whatsapp":{downloadMedia:async()=>Buffer.alloc(1200)},
    "@/lib/kompasSpeech":{SpeechError,audioType:m=>["audio/ogg","audio/mp4","audio/mpeg","audio/webm"].includes(m)?m:null,transcribeAudio:async()=>({text:"Kompas"})},
    "@/lib/sttLedger":{hashUserId:id=>"hashed-"+id},
  })[key]||nodeRequire(key),
  Buffer,Uint8Array,Date,
})
const fn=mod.exports.speechToWhatsAppText
const audio=(id="V1234",mime_type="audio/ogg; codecs=opus")=>({id:"wamid.example",from:"15552223333",type:"audio",audio:{id,mime_type,voice:true}})
function deps(overrides={}){
  const calls={downloads:0,transcripts:0,owner:"",size:0}
  return {calls,instance:{
    download:async(id,limit)=>{calls.downloads++;calls.size=limit;return Buffer.alloc(1200)},
    transcribe:async arg=>{calls.transcripts++;calls.owner=arg.userHash;return {text:"Explain privilege escalation",seconds:1}},
    hash:owner=>"hash:"+owner,
    ...overrides,
  }}
}
test("01: actual OGG/Opus WhatsApp note becomes regular text without changing id",async()=>{
  const {calls,instance}=deps()
  const original=audio()
  const r=await fn(original,"account-one",instance)
  assert.equal(r.ok,true)
  assert.equal(r.message.type,"text")
  assert.equal(r.message.text.body,"Explain privilege escalation")
  assert.equal(r.message.id,original.id)
  assert.equal(r.message.mfitVoiceNote,true)
  assert.equal(original.type,"audio")
  assert.equal(calls.transcripts,1)
  assert.equal(calls.owner,"hash:account-one")
  assert.equal(calls.size,4*1024*1024)
  assert.ok(r.elapsedMs>=0)
})
test("02: speech commands reuse exact Kompas and revert command routing",async()=>{
  const {instance}=deps({transcribe:async()=>({text:" KOMPAS "})})
  const r=await fn(audio(),"account-one",instance)
  assert.equal(r.message.text.body.trim().toLowerCase(),"kompas")
  const b=deps({transcribe:async()=>({text:"revert"})})
  assert.equal((await fn(audio(),"account-one",b.instance)).message.text.body,"revert")
})
test("03: dictated ordinary JD is delivered as text to default tailoring mode",async()=>{
  const {instance}=deps({transcribe:async()=>({text:"Title: Network Security Engineer. Cisco ISE and Active Directory required."})})
  const r=await fn(audio(),"account",instance)
  assert.match(r.message.text.body,/Cisco ISE/)
  assert.equal(r.message.type,"text")
})
test("04: a verified account is required before any media download",async()=>{
  const {instance,calls}=deps()
  const r=await fn(audio(),"",instance)
  assert.equal(r.ok,false)
  assert.equal(calls.downloads,0)
  assert.equal(calls.transcripts,0)
})
test("05: corrupt and unsupported media are refused before provider billing",async()=>{
  const {instance,calls}=deps()
  const missing=await fn({type:"audio",audio:{id:""}},"account",instance)
  assert.equal(missing.ok,false)
  const bad=await fn(audio("V1234","audio/amr"),"account",instance)
  assert.equal(bad.ok,false)
  assert.equal(calls.transcripts,0)
})
test("06: empty media or failed downloads return actionable feedback",async()=>{
  const r=await fn(audio(),"account",deps({download:async()=>Buffer.alloc(10)}).instance)
  assert.equal(r.ok,false)
  assert.match(r.reply,/too short/)
  const b=await fn(audio(),"account",deps({download:async()=>{throw Error("Meta 404")}}).instance)
  assert.equal(b.ok,false)
  assert.doesNotMatch(b.reply,/404/)
})
test("07: there is a hard 4MiB memory bound",async()=>{
  const r=await fn(audio(),"account",deps({download:async()=>Buffer.alloc(4*1024*1024+1)}).instance)
  assert.equal(r.ok,false)
  assert.match(r.reply,/too large/)
})
test("08: busy and unavailable speech recognition have distinct non-leaking replies",async()=>{
  const r=await fn(audio(),"account",deps({transcribe:async()=>{throw new SpeechError("busy")}}).instance)
  assert.equal(r.ok,false)
  assert.match(r.reply,/busy/)
  const u=await fn(audio(),"account",deps({transcribe:async()=>{throw Error("GROQ_SECRET=confidential")}}).instance)
  assert.equal(u.ok,false)
  assert.doesNotMatch(u.reply,/confidential|GROQ_SECRET/)
})
test("09: no speech becomes an intelligible retry, not a false answer",async()=>{
  const r=await fn(audio(),"account",deps({transcribe:async()=>({text:"  "})}).instance)
  assert.equal(r.ok,false)
  assert.match(r.reply,/clear speech/)
})
test("10: webhook only transcribes authenticated deduplicated messages, dispatching same handler",()=>{
  const webhook=readFileSync("src/app/api/whatsapp/webhook/route.ts","utf8")
  const authorized=webhook.indexOf("const sender = await resolveWhatsAppUser(from)")
  const receipt=webhook.indexOf("if (!await blob.putIfAbsent(`whatsapp/receipts/${receipt}`, \"1\"))")
  const transcribe=webhook.indexOf("await speechToWhatsAppText(msg, userId)")
  const handle=webhook.indexOf("await handle(from, input, session, userId, verifiedKompasAccount)")
  assert.ok(authorized>0 && authorized<receipt && receipt<transcribe && transcribe<handle)
  assert.match(webhook,/if \(String\(msg\.type \|\| ""\) === "audio"\)/)
  assert.doesNotMatch(webhook,/await handle\(from, msg, session, userId, verifiedKompasAccount\)/)
})
test("11: audio is transient; provider gets just audio and account hash, not stored blobs",()=>{
  const source=readFileSync(path,"utf8")
  assert.doesNotMatch(source,/blob\.put|writePath|storeAudio|archiveSessionChunk/)
  assert.match(source,/purpose: "transcribe"/)
  assert.match(source,/userHash: deps\.hash\(owner\)/)
})
test("12: latency path has no extra LLM intent classification or artificial wait",()=>{
  const source=readFileSync(path,"utf8")
  const webhook=readFileSync("src/app/api/whatsapp/webhook/route.ts","utf8")
  assert.doesNotMatch(source,/setTimeout|sleep\(|callLLM|classifyIntent|modelPrompt/)
  assert.match(webhook,/if \(typeof after === "function"\) after\(work\)/)
})
