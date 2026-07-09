import { NextRequest, NextResponse } from "next/server"
import { mkdir, rename, readdir, rmdir } from "fs/promises"
import path from "path"
import { createClient } from "@/lib/supabase/server"
import { ensureIndex } from "@/lib/keywords"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"

export const runtime = "nodejs"

async function getUserDir(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id ?? "demo"
    const dir = path.join(USER_RESUMES_BASE, userId)
    await mkdir(dir, { recursive: true })
    return dir
  } catch {
    const dir = path.join(USER_RESUMES_BASE, "demo")
    await mkdir(dir, { recursive: true }).catch(() => {})
    return dir
  }
}

export async function POST(request: NextRequest) {
  const userDir = await getUserDir()

  const body = await request.json().catch(() => ({}))
  const files: string[] = body.files ?? []
  const targetParts = String(body.target || "")
    .split("/")
    .map(s => s.replace(/[^A-Za-z0-9._ \-()]/g, "_").trim())
    .filter(Boolean)

  if (!files.length) return NextResponse.json({ error: "No files selected." }, { status: 400 })
  if (!targetParts.length) return NextResponse.json({ error: "Enter a destination folder." }, { status: 400 })

  const userResolved = path.resolve(userDir)
  const targetDir = path.resolve(path.join(userDir, ...targetParts))
  if (!targetDir.startsWith(userResolved)) {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 })
  }
  await mkdir(targetDir, { recursive: true })

  let moved = 0
  for (const f of files) {
    const src = path.resolve(f)
    if (!src.startsWith(userResolved + path.sep)) continue
    const dest = path.join(targetDir, path.basename(src))
    if (dest === src) continue
    try {
      await rename(src, dest)
      moved++
      const parent = path.dirname(src)
      if (parent !== userResolved) {
        try { if ((await readdir(parent)).length === 0) await rmdir(parent) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  await ensureIndex(userDir).catch(() => {})
  return NextResponse.json({ ok: true, moved, target: targetParts.join(" / ") })
}
