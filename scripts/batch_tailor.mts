// Batch-tailor resumes THROUGH THE WEB APP with auto-select ON.
// For each cleaned JD it POSTs to /api/tailor with an empty filepath (so the server
// picks the best resume by identity), downloads the tailored .docx, and zips them all.
// Run: COUNT=50 npx tsx scripts/batch_tailor.mts   (server must be running with ANTHROPIC_API_KEY)
import { readFile, writeFile, mkdir, readdir, rm } from "fs/promises"
import path from "path"
import mammoth from "mammoth"
import JSZip from "jszip"

const SERVER = process.env.SERVER || "http://localhost:3000"
const COUNT = Number(process.env.COUNT || 50)
// ONLY="data architect,data engineer" → process only JDs whose title matches one of these.
const ONLY = (process.env.ONLY || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean)
const DIAG = ONLY.length > 0  // a targeted re-run: don't disturb the real batch output/zip
const OUT = path.join(process.cwd(), "data", DIAG ? "diag_out" : "batch_out")
const ZIP_PATH = path.join(process.cwd(), "data", "Tailored_Resumes.zip")
const DOCS = [
  "C:/Users/Eshwa/OneDrive/Documents/6-28-2026-LindnSearch.docx",
  "C:/Users/Eshwa/OneDrive/Documents/Search Reporrt.docx",
  "C:/Users/Eshwa/OneDrive/Documents/Search_Report.docx",
]

const CHROME = /^(follow|connect|like|comment|repost|send|feed post|see more|see less|verified|\d+(st|nd|rd|th)?$|\d+ (reactions?|comments?).*|.*\bago\b.*•.*|visible to anyone.*)$/i
// Lazy + length-capped so it stops at the FIRST role word (won't span multi-role vendor posts).
const TITLE_RE = /\b(cyber|security|software|data|devops|cloud|network|systems?|application|full[\s-]?stack|front[\s-]?end|back[\s-]?end|site reliability|platform|ai|ml|machine learning|iam|pam|soc|grc|penetration|pen[\s-]?test|red team|service[\s-]?now|sap|sre|servicenow)\b[\w /&+-]{0,30}?\b(engineer|developer|analyst|administrator|architect|consultant|specialist|scientist|lead|manager|tester)\b/i
const HARVEST = /share your (latest )?(resume|profile)|@\S+\.\w|please share|if interested|w2 ?(&|and)? ?c2c|c2c (is )?open|visa|opt|h1b|gc ?(holder|profile)|bench sales|vendor list|rate:|duration:|location:\s*$/i

function stripEmoji(s: string) {
  return s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, "")
          .replace(/[•▶►◄✅❌🔥💹📍📩📧🚀⭐➡️👉]/g, " ").replace(/[\u{1D400}-\u{1D7FF}]/gu, "")
}
function cleanJD(raw: string): { title: string; jd: string } | null {
  let lines = raw.split("\n").map(l => stripEmoji(l).replace(/\s+/g, " ").trim()).filter(Boolean)
  lines = lines.filter(l => !CHROME.test(l))
  const titleLine = lines.find(l => TITLE_RE.test(l))
  if (!titleLine) return null
  // The lazy/capped regex yields a short title even from a long line.
  const title = titleLine.match(TITLE_RE)![0].replace(/\s+/g, " ").trim()
  // Reject titles that bled into body prose (contain sentence connector words).
  if (/\s(to|the|of|with|that|will|for|including|across|using)\s/i.test(title)) return null
  const body = lines.filter(l => !HARVEST.test(l))
  const jd = (title + "\n" + body.join("\n")).slice(0, 3500)
  if (jd.length < 300) return null
  return { title, jd }
}

function jdScore(t: string): number {
  const s = t.toLowerCase()
  let n = 0
  for (const k of ["responsibilities", "requirements", "qualifications", "experience with", "proficiency", "what you", "you will", "must have", "looking for"]) if (s.includes(k)) n++
  return n
}

async function collectJDs(): Promise<{ title: string; jd: string }[]> {
  const out: { title: string; jd: string }[] = []
  const seen = new Set<string>()
  for (const p of DOCS) {
    let value = ""
    try { value = (await mammoth.extractRawText({ buffer: await readFile(p) })).value } catch { continue }
    for (const post of value.split(/\n\s*Feed post\s*\n/i)) {
      if (post.length < 400 || jdScore(post) < 2) continue
      const c = cleanJD(post)
      if (!c) continue
      const key = c.title.toLowerCase().replace(/[^a-z ]/g, "").split(" ").slice(0, 3).join(" ")
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

function sanitize(s: string) { return s.replace(/[^A-Za-z0-9 +&-]/g, "_").replace(/\s+/g, " ").trim().slice(0, 40) }

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const jds = await collectJDs()
  console.log(`collected ${jds.length} unique JDs; tailoring ${Math.min(COUNT, jds.length)} via the web app (auto-select)…`)

  const manifest: string[] = ["# Tailored resumes — JD → matched resume (auto-selected) → match score", ""]
  let ok = 0
  for (let i = 0; i < jds.length && ok < COUNT; i++) {
    const { title, jd } = jds[i]
    if (ONLY.length && !ONLY.some(o => title.toLowerCase().includes(o))) continue
    try {
      const res = await fetch(`${SERVER}/api/tailor`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd, filepath: "" }), // empty = AUTO-SELECT
      })
      const data = await res.json()
      if (!res.ok || data.error) { console.log(`  [skip] "${title}" -> ${data.error || res.status}`); continue }
      const cat = (data.matched?.category || "").split("/").pop()?.trim() || "?"
      const name = data.matched?.filename || "Resume"
      const f = await fetch(`${SERVER}/api/tailor/file?token=${data.token}&fmt=docx&name=${encodeURIComponent(name)}`)
      if (!f.ok) { console.log(`  [skip] "${title}" -> download ${f.status}`); continue }
      ok++
      const file = `${String(ok).padStart(2, "0")}_${sanitize(cat)}__${sanitize(title)}.docx`
      await writeFile(path.join(OUT, file), Buffer.from(await f.arrayBuffer()))
      manifest.push(`${String(ok).padStart(2, "0")}. JD: ${title}`)
      manifest.push(`     -> ${cat} / ${name}   |   match ${data.score_before ?? "?"}% -> ${data.score}%`)
      console.log(`  [ok ${ok}] "${title}"  ->  ${cat} / ${name}  (${data.score_before}%->${data.score}%)`)
    } catch (e) { console.log(`  [err] "${title}" -> ${String(e).slice(0, 80)}`) }
  }

  await writeFile(path.join(OUT, "INDEX.txt"), manifest.join("\n"))
  if (DIAG) {
    console.log(`\nDIAG DONE: ${ok} tailored (filter: ${ONLY.join(", ")}). Output: ${OUT} (zip untouched)`)
    return
  }
  // zip everything
  const zip = new JSZip()
  for (const f of await readdir(OUT)) zip.file(f, await readFile(path.join(OUT, f)))
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  await writeFile(ZIP_PATH, buf)
  console.log(`\nDONE: ${ok} resumes tailored. Zip: ${ZIP_PATH}`)
}
main()
