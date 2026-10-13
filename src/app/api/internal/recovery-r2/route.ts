import { NextRequest, NextResponse } from "next/server"
import { blob } from "@/lib/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const needles = [
  "m4a","transcript","realtime","langgraph","n8n","vector","vanguard","hawaii",
  "50k","technical_data","technical-data","security_engineering","security-engineering",
  "voice_and_email","voice-email","interactive_3d","interactive-3d"
]

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") return NextResponse.json({error:"not found"},{status:404})
  const token=request.nextUrl.searchParams.get("token")
  if (!process.env.RECOVERY_SCAN_TOKEN || token!==process.env.RECOVERY_SCAN_TOKEN) {
    return NextResponse.json({error:"not found"},{status:404})
  }
  const keys=await blob.list("")
  const rows=await Promise.all(keys.filter(k=>{
    const s=k.toLowerCase()
    return needles.some(n=>s.includes(n)) || /\.(m4a|mp3|wav|txt|md|srt|vtt|json)$/i.test(k)
  }).slice(0,5000).map(async key=>{
    const stat=await blob.stat(key)
    return {key,size:stat?.size??null,modified:stat?.mtime?.toISOString()??null}
  }))
  return NextResponse.json({totalKeys:keys.length,matchCount:rows.length,rows})
}
