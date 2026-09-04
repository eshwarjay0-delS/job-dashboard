import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createClient } from "@/lib/supabase/server"
import { ensureIndex } from "@/lib/keywords"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { movePath } from "@/lib/storage"

export const runtime = "nodejs"

async function getUserDir(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return path.join(USER_RESUMES_BASE, data.user?.id ?? "demo")
  } catch {
    return path.join(USER_RESUMES_BASE, "demo")
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
  // Exact-or-separator. A bare prefix also accepts a sibling directory whose
  // name merely starts with the allowed one (line 42 already does this right).
  if (!(targetDir === userResolved || targetDir.startsWith(userResolved + path.sep))) {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 })
  }

  let moved = 0
  for (const f of files) {
    const src = path.resolve(f)
    if (!src.startsWith(userResolved + path.sep)) continue
    const dest = path.join(targetDir, path.basename(src))
    if (dest === src) continue
    await movePath(src, dest) // copy-then-delete; works on both fs and object storage
    moved++
  }

  await ensureIndex(userDir).catch(() => {})
  return NextResponse.json({ ok: true, moved, target: targetParts.join(" / ") })
}
