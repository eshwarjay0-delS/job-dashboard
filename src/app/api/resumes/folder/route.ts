import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { writePath } from "@/lib/storage"

export const runtime = "nodejs"



export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  const userDir = path.join(USER_RESUMES_BASE, userId)

  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== "string") return NextResponse.json({ error: "Invalid folder name." }, { status: 400 })
  const { name } = body
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
