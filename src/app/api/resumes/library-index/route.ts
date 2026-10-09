import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createHash } from "crypto"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, readPath, readPathText, writePath, statPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { extractKeywords } from "@/lib/keywords"

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
type Entry = { id:string; filename:string; category:string; identity:string|null; identities:string[]; technologies:string[]; specializations:string[]; fingerprint:string; updatedAt:string }
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
  try { cache=JSON.parse(await readPathText(cacheFile)) } catch {}
  const paths=(await listFiles(base)).filter(p=>p.toLowerCase().endsWith(".docx")).slice(0,MAX_INDEXED)
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
      const plain=await extractText(bytes)
      const technologies=extractKeywords(plain)
      const identities=safeEmail(plain.slice(0,2500))
      const fingerprint=createHash("sha256").update(bytes).digest("hex")
      next[relative]={signature,entry:{
        id:createHash("sha256").update(userId+"\0"+relative).digest("hex").slice(0,24),
        filename:path.basename(filepath),category:path.dirname(relative)==="."?"General":path.dirname(relative),
        identity:identities.length===1?identities[0]:null,identities,
        technologies,specializations:classify(technologies),fingerprint,updatedAt:stat.mtime.toISOString()
      }}
    } catch { errors.push(path.basename(filepath)) }
  }
  try { await writePath(cacheFile,Buffer.from(JSON.stringify(next))) } catch { errors.push("Index cache could not be saved") }
  const entries=Object.values(next).map(x=>x.entry)
  const identity=request.nextUrl.searchParams.get("identity")?.toLowerCase()
  const filtered=identity?entries.filter(x=>x.identity===identity):entries
  return NextResponse.json({entries:filtered,total:entries.length,scanned:paths.length,limited:paths.length===MAX_INDEXED,errors,identities:[...new Set(entries.flatMap(x=>x.identities))].sort(),note:"Ambiguous or missing resume email remains unassigned. All data is scoped to the signed-in user."})
}
