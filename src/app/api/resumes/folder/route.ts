import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { writePath } from "@/lib/storage"

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

  const { name } = await request.json().catch(() => ({}))
  const parts = String(name || "")
    .split("/")
    .map(s => s.replace(/[^A-Za-z0-9._ \-()]/g, "_").trim())
    .filter(Boolean)
  if (!parts.length) return NextResponse.json({ error: "Enter a folder name." }, { status: 400 })

  const dest = path.resolve(path.join(userDir, ...parts))
  const folderBase = path.resolve(userDir)
  // Exact-or-separator: the name sanitizer keeps ".", so ".." can survive and
  // a bare prefix check would also accept a sibling directory.
  if (!(dest === folderBase || dest.startsWith(folderBase + path.sep))) {
    return NextResponse.json({ error: "Invalid folder name." }, { status: 400 })
  }
  // Object stores have no empty folders — write a hidden ".keep" marker so the new
  // (empty) folder still shows in the library listing. It's excluded from file lists.
  await writePath(path.join(dest, ".keep"), "")
  return NextResponse.json({ ok: true, folder: parts.join(" / ") })
}
