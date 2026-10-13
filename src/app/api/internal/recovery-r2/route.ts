import { NextRequest, NextResponse } from "next/server"
import { blob } from "@/lib/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const needles = [
  "transcript","m4a","realtime","langgraph","n8n","vector","vanguard",
  "hawaii","50k","technical_data","technical-data","nikita","architecting",
  "security_engineering","security-engineering","ai_technical_interview",
  "ai-technical-interview","voice_and_email","voice-email"
]

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!process.env.RECOVERY_SCAN_TOKEN || token !== process.env.RECOVERY_SCAN_TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const keys = await blob.list("")
  const matching = keys.filter((key) => {
    const s = key.toLowerCase()
    return needles.some((n) => s.includes(n))
      || (/\.(txt|md|json|jsonl|srt|vtt)$/i.test(key) && /trans|audio|record|kompas/i.test(key))
  })
  const rows = await Promise.all(matching.slice(0, 1000).map(async (key) => {
    const stat = await blob.stat(key)
    return { key, size: stat?.size ?? null, modified: stat?.mtime?.toISOString() ?? null }
  }))
  return NextResponse.json({ totalKeys: keys.length, matchCount: rows.length, rows })
}
