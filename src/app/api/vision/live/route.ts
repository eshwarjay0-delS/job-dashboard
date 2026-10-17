import { NextRequest } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { JOURNAL_UPDATED, PLAN_JOURNAL } from "@/lib/plan-vision-journal"
import { execFile } from "child_process"
import { promisify } from "util"
import { stat } from "fs/promises"
import path from "path"

const execFileAsync = promisify(execFile)

// Live Plan & Vision status. The decision & delivery journal (PLAN_JOURNAL) is the
// single source of truth for ideas, prompts, wishes, approvals, delivery state and
// blockers — it ships with each deploy. The git log is read fresh on every request
// (gracefully empty where git is unavailable, e.g. production serverless).
export async function GET(request: NextRequest) {
  if (!await adminOf(request)) return new Response("Admin access required", { status: 403, headers: { "Cache-Control": "no-store" } })

  const repoRoot = path.resolve(process.cwd())
  const docsDir = path.join(repoRoot, "docs")

  // ── Recent commits (live git log) ──
  type Commit = { hash: string; date: string; message: string; product: string }
  let commits: Commit[] = []
  try {
    const { stdout } = await execFileAsync("git", ["log", "--pretty=format:%h|%ad|%s", "--date=short", "-25"], { cwd: repoRoot, timeout: 8000 })
    const guess = (msg: string): string => {
      const m = msg.toLowerCase()
      if (/kompas/i.test(m)) return "kompas"
      if (/crawl|portal|apply|job/i.test(m)) return "applications"
      if (/gmail|inbox|poke|watcher|mail/i.test(m)) return "gmail"
      if (/tailor|resume|whatsapp/i.test(m)) return "resume"
      return "all"
    }
    commits = stdout.split("\n").filter(Boolean).map(l => {
      const [hash, date, ...msgParts] = l.split("|")
      const message = msgParts.join("|")
      return { hash, date, message, product: guess(message) }
    })
  } catch { /* git unavailable — hub shows the journal without the commit feed */ }

  // ── Vision doc freshness ──
  const docFiles: Record<string, string> = { gmail: "gmail.md", apply: "apply.md", resume: "resume.md", kompas: "kompas.md" }
  const visionUpdated: Record<string, string | null> = {}
  for (const [product, file] of Object.entries(docFiles)) {
    try {
      const s = await stat(path.join(docsDir, file))
      visionUpdated[product] = s.mtime.toISOString()
    } catch { visionUpdated[product] = null }
  }

  return Response.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      journalUpdated: JOURNAL_UPDATED,
      journal: PLAN_JOURNAL,
      commits,
      visionUpdated,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
