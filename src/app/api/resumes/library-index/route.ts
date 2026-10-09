import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createHash } from "crypto"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, readPath, readPathText, writePath, statPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { extractKeywords } from "@/lib/keywords"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
const MAX_INDEXED = 200
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const GROUPS: Record<string, string[]> = {
  "Cloud Security": ["aws","azure","gcp","cloud security","cspm","guardduty","defender"],
  "SIEM & SOC": ["siem","soc","splunk","sentinel","qradar","detection engineering","soar"],
  "Application Security": ["appsec","application security","owasp","sast","dast","burp suite"],
  "Offensive Security": ["penetration testing","pentest","red team","metasploit","oscp"],
  "Identity & Access": ["iam","pam","saml","oauth","okta","active directory","rbac"],
  "DevSecOps": ["devsecops","docker","kubernetes","terraform","ci/cd","snyk"],
  "Data & AI": ["snowflake","spark","kafka","machine learning","llm","rag"],
  "Software Engineering": ["java","typescript","react","node.js","python","spring boot"],
  "Network Security": ["firewall","cisco","vpn","ids","ips","network security"],
  "GRC": ["grc","nist","iso 27001","risk assessment","compliance"]
}
type Entry = { id:string; filename:string; sourceFilename:string; category:string; identity:string|null; identities:string[]; technologies:string[]; specializations:string[]; fingerprint:string; updatedAt:string }
type Cached = { signature:string; entry:Entry }
function classify(terms:string[]) {
  const set=new Set(terms)
  return Object.entries(GROUPS).map(([name, words])=>({name,score:words.filter(w=>set.has(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.name)
}
function safeEmail(text:string) { return [...new Set((text.match(EMAIL_RE)||[]).map(s=>s.toLowerCase()))] }
export async function GET(request:NextRequest) {
  const userId=await authenticatedUserId(request)
  if(!userId) return signInRequired()
  const base=path.join(USER_RESUMES_DIR,userId)
  const cacheFile=path.join(base,".resume-library-index.json")
  const refresh=request.nextUrl.searchParams.get("refresh")==="true"
  let cache:Record<string,Cached>={}
  try { cache=JSON.parse((await readPathText(cacheFile)) || "{}") } catch {}
  const allPaths=(await listFiles(base).catch(() => [] as string[])).filter(p=>p.toLowerCase().endsWith(".docx"))
  const paths=allPaths.slice(0,MAX_INDEXED)
  const next:Record<string,Cached>={}
  const errors:string[]=[]
  for(const filepath of paths) {
    try {
      const stat=await statPath(filepath)
      if(!stat) continue
      const relative=path.relative(base,filepath)
      if(relative.startsWith("..")||path.isAbsolute(relative)) continue
      const signature=`${stat.size}:${stat.mtime.getTime()}`
      if(!refresh && cache[relative]?.signature===signature) { next[relative]=cache[relative];continue }
      const bytes=await readPath(filepath)
      if (!bytes) { errors.push(path.basename(filepath)); continue }
      const plain=await extractText(bytes)
      const technologies=extractKeywords(plain)
      const identities=safeEmail(plain.slice(0,2500))
      const fingerprint=createHash("sha256").update(bytes).digest("hex")
      next[relative]={signature,entry:{
        id:createHash("sha256").update(userId+"\0"+relative).digest("hex").slice(0,24),
        filename:path.basename(filepath),sourceFilename:path.basename(filepath),category:path.dirname(relative)==="."?"General":path.dirname(relative),
        identity:identities.length===1?identities[0]:null,identities,
        technologies,specializations:classify(technologies),fingerprint,updatedAt:stat.mtime.toISOString()
      }}
    } catch { errors.push(path.basename(filepath)) }
  }
  try { await writePath(cacheFile,Buffer.from(JSON.stringify(next))) } catch { errors.push("Index cache could not be saved") }
  const entries=Object.values(next).map(x=>x.entry)
  if (serviceClientAvailable() && /^[0-9a-f-]{36}$/i.test(userId)) {
    try {
      const db = createServiceClient()
      const { data: docs, error: dbError } = await db.from("resume_documents").select("id,sha256,storage_path,keywords,created_at,library_id,specialization_id").eq("user_id",userId).order("created_at",{ascending:false}).limit(1000)
      if (dbError) throw dbError
      const { data: libs } = await db.from("resume_email_libraries").select("id,email").eq("user_id",userId)
      const { data: folders } = await db.from("resume_specializations").select("id,name").eq("user_id",userId)
      const emails = new Map((libs||[]).map(v=>[v.id,v.email]))
      const names = new Map((folders||[]).map(v=>[v.id,v.name]))
      const known = new Set(entries.map(v=>v.fingerprint))
      for (const doc of docs||[]) {
        if (known.has(doc.sha256)) continue
        const identity=emails.get(doc.library_id)||null
        const category=names.get(doc.specialization_id)||"General"
        entries.push({id:doc.id,filename:path.basename(doc.storage_path),sourceFilename:path.basename(doc.storage_path),category,identity,identities:identity?[identity]:[],technologies:doc.keywords||[],specializations:[category],fingerprint:doc.sha256,updatedAt:doc.created_at})
        known.add(doc.sha256)
      }
    } catch(error) { errors.push("Supabase index unavailable: "+String(error).slice(0,120)) }
  } else if (!serviceClientAvailable()) { errors.push("Supabase service credentials not configured.") }
  const identity=request.nextUrl.searchParams.get("identity")?.toLowerCase()
  const filtered=identity?entries.filter(x=>x.identity===identity):entries
  const libraries=Object.entries(entries.reduce((acc,entry)=>{ const key=entry.identity || "Unverified"; (acc[key] ||= []).push(entry); return acc },{} as Record<string,Entry[]>)).map(([email,items])=>({email,documentCount:items.length,specializations:[...new Set(items.flatMap(item=>item.specializations))],ambiguous:email==="Unverified"})).sort((a,b)=>a.email.localeCompare(b.email))
  return NextResponse.json({entries:filtered,total:entries.length,scanned:paths.length,limited:allPaths.length>MAX_INDEXED,libraries,errors,identities:[...new Set(entries.flatMap(x=>x.identities))].sort(),note:"Ambiguous or missing resume email remains unassigned. All data is scoped to the signed-in user."})
}
