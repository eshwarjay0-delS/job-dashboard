import { NextRequest } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { execFile } from "child_process"
import { promisify } from "util"
import { readFile, stat } from "fs/promises"
import path from "path"

const execFileAsync = promisify(execFile)

// Live Plan & Vision status — read fresh on EVERY request, never cached.
// Wishes come from docs/wishes.md (the ledger), commits from git log,
// vision freshness from docs/*.md mtimes. This is what makes the hub "real time".
export async function GET(request: NextRequest) {
  if (!await adminOf(request)) return new Response("Admin access required", { status: 403, headers: { "Cache-Control": "no-store" } })

  const repoRoot = path.resolve(process.cwd())
  const docsDir = path.join(repoRoot, "docs")

  // ── Wishes ledger ──
  type Wish = { product: string; status: string; title: string; date: string | null; note: string }
  const wishes: Wish[] = []
  try {
    const raw = await readFile(path.join(docsDir, "wishes.md"), "utf8")
    let product = "general"
    for (const line of raw.split("\n")) {
      const h = line.match(/^##\s+(.+)/)
      if (h) { product = h[1].trim().toLowerCase(); continue }
      const m = line.match(/^-\s*\[([a-z]+)\]\s*(.+)/)
      if (!m) continue
      const status = m[1].trim()
      let rest = m[2].trim()
      let date: string | null = null
      const dm = rest.match(/\((\d{4}-\d{2}-\d{2})\)/)
      if (dm) { date = dm[1]; rest = rest.replace(dm[0], "").trim() }
      const parts = rest.split("—")
      wishes.push({ product, status, title: parts[0].trim(), date, note: parts.slice(1).join("—").trim() })
    }
  } catch { /* ledger missing — hub shows empty state */ }

  // ── Recent commits (live git log) ──
  type Commit = { hash: string; date: string; message: string; product: string }
  let commits: Commit[] = []
  try {
    const { stdout } = await execFileAsync("git", ["log", "--pretty=format:%h|%ad|%s", "--date=short", "-25"], { cwd: repoRoot, timeout: 8000 })
    const guess = (msg: string): string => {
      const m = msg.toLowerCase()
      if (/crawl|portal|apply|job/i.test(m) && !/kompas/i.test(m)) return "apply"
      if (/gmail|inbox|poke|watcher|mail/i.test(m)) return "gmail"
      if (/tailor|resume|whatsapp/i.test(m)) return "resume"
      if (/kompas|voice|session/i.test(m)) return "kompas"
      if (/vision|plan/i.test(m)) return "general"
      return "general"
    }
    commits = stdout.split("\n").filter(Boolean).map(l => {
      const [hash, date, ...msgParts] = l.split("|")
      const message = msgParts.join("|")
      return { hash, date, message, product: guess(message) }
    })
  } catch { /* git unavailable — hub shows empty state */ }

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
    { ok: true, generatedAt: new Date().toISOString(), wishes, commits, visionUpdated },
    { headers: { "Cache-Control": "no-store" } },
  )
}
