import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { listFiles, readPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { extractKeywords } from "@/lib/keywords"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

// Match is scoped to the authenticated tenant and to the resume's actual contact email.
// Folder names alone never authorize cross-identity selection.
export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const body = await request.json().catch(() => null)
  const jd = typeof body?.jd === "string" ? body.jd.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (jd.length < 60 || jd.length > 80000 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({error:"Provide a job description (60 to 80000 characters) and a valid library email."},{status:400})
  }
  const root = path.resolve(USER_RESUMES_DIR,userId)
  const jdKeywords = new Set(extractKeywords(jd))
  const files = (await listFiles(root).catch(() => [] as string[]))
    .filter(f => f.toLowerCase().endsWith(".docx") && path.resolve(f).startsWith(root + path.sep))
    .slice(0,250)
  const matches: {filepath:string;score:number;matched:string[];specialization:string}[] = []
  for (const filepath of files) {
    try {
      const bytes = await readPath(filepath)
      if (!bytes) continue
      const plain = await extractText(bytes)
      const emails = [...new Set((plain.slice(0,4000).match(EMAIL_RE) || []).map(x => x.toLowerCase()))]
      if (emails.length !== 1 || emails[0] !== email) continue
      const terms = new Set(extractKeywords(plain))
      const matched = [...jdKeywords].filter(t => terms.has(t))
      const specialization = path.relative(root,filepath).split(path.sep).slice(0,-1).join("/")
      matches.push({filepath,score:jdKeywords.size?Math.round(100*matched.length/jdKeywords.size):0,matched,specialization})
    } catch { /* unreadable files are excluded */ }
  }
  matches.sort((a,b) => b.score-a.score || a.filepath.localeCompare(b.filepath))
  return NextResponse.json({email,total:matches.length,best:matches[0] || null,alternatives:matches.slice(1,6),jdKeywordCount:jdKeywords.size})
}
