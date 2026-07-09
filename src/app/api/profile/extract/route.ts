import { NextRequest, NextResponse } from "next/server"
import { extractProfile } from "@/lib/profile"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB — a .docx resume should never exceed this

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Upload a .docx resume file." }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB).` }, { status: 413 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const profile = await extractProfile(buf)
    return NextResponse.json({ profile })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
