import { readdir, stat, mkdir } from "fs/promises"
import path from "path"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ResumeClient from "./ResumeClient"
import { USER_RESUMES_DIR } from "@/lib/paths"

export interface ResumeFile {
  id: string
  filename: string
  filepath: string
  category: string
  size: string
  uploadedAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileId(fullPath: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < fullPath.length; i++) {
    h ^= fullPath.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return "f_" + (h >>> 0).toString(36)
}

async function scanDir(dir: string, category = ""): Promise<ResumeFile[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const tasks = entries
    .filter(e => !e.name.startsWith("~$") && !e.name.startsWith(".") && e.name !== "_keywords.json")
    .map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const subCat = category ? `${category} / ${entry.name}` : entry.name
        return scanDir(fullPath, subCat)
      }
      if (!entry.name.toLowerCase().endsWith(".docx")) return []
      const info = await stat(fullPath)
      return [{
        id: fileId(fullPath),
        filename: entry.name.replace(/\.docx$/i, ""),
        filepath: fullPath,
        category: category || "General",
        size: formatSize(info.size),
        uploadedAt: info.mtime.toISOString(),
      }]
    })

  return (await Promise.all(tasks)).flat()
}

async function listFolders(dir: string, base = ""): Promise<string[]> {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
  const out: string[] = []
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue
    const rel = base ? `${base} / ${e.name}` : e.name
    out.push(rel)
    out.push(...await listFolders(path.join(dir, e.name), rel))
  }
  return out
}

export const dynamic = "force-dynamic"

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Demo mode: show the page without auth (uses a shared demo folder)
  const userId = user?.id ?? "demo"

  const userDir = path.join(USER_RESUMES_DIR, userId)
  await mkdir(userDir, { recursive: true }).catch(() => {})

  const [files, folders] = await Promise.all([scanDir(userDir), listFolders(userDir)])
  return <ResumeClient initialFiles={files} initialFolders={folders} />
}
