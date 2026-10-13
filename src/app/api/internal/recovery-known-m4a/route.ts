import { NextResponse } from "next/server"
import { blob } from "@/lib/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const wanted = [
  "building_realtime_ai_mobile_apps",
  "building_voice_and_email_ai_agents",
  "architecting_interactive_3d_web_applications",
  "inside_vanguard_s_eight_trillion_dollar_playbook",
  "technical_data_analysis_for_software_engineers",
  "why_vector_databases_kill_ai_apps",
  "winning_the_hawaii_healthcare_network_interview",
  "the_50k_ai_pitch_reality_check",
  "senior_security_engineering_interview_playbook",
  "how_to_pass_senior_security_engineering_interviews"
]

function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}

export async function GET() {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({error:"not found"},{status:404})
  const keys=await blob.list("")
  const matches=keys.filter(k=>{
    const n=norm(k)
    return wanted.some(w=>n.includes(w)) && /\.(m4a|mp3|wav|txt|md|srt|vtt|json)$/i.test(k)
  })
  const rows=await Promise.all(matches.map(async key=>{
    const stat=await blob.stat(key)
    return {key,size:stat?.size??null,modified:stat?.mtime?.toISOString()??null}
  }))
  return NextResponse.json({matches:rows})
}
