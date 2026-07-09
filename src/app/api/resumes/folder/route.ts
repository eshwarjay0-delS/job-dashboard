import { NextRequest, NextResponse } from "next/server"
import { mkdir } from "fs/promises"
import path from "path"
import { createClient } from "@/lib/supabase/server"
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

  const { name } = await request.json().catch(() => ({}))
  const parts = String(name || "")
    .split("/")
    .map(s => s.replace(/[^A-Za-z0-9._ \-()]/g, "_").trim())
    .filter(Boolean)
  if (!parts.length) return NextResponse.json({ error: "Enter a folder name." }, { status: 400 })

  const dest = path.resolve(path.join(userDir, ...parts))
  if (!dest.startsWith(path.resolve(userDir))) {
    return NextResponse.json({ error: "Invalid folder name." }, { status: 400 })
  }
  await mkdir(dest, { recursive: true })
  return NextResponse.json({ ok: true, folder: parts.join(" / ") })
}
