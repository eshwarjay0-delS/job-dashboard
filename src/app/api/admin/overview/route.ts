import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { authenticatedUser } from "@/lib/authBoundary"

export const runtime="nodejs"; export const dynamic="force-dynamic"
export async function GET(request: NextRequest){
 const admin = await adminOf(request)
 if(!admin){
  const user = await authenticatedUser(request)
  if(!user || user.synthetic) return NextResponse.json({error:"Authentication required."},{status:401})
  return NextResponse.json({error:"Owner access required."},{status:403})
 }
 const email = admin.by === "email" ? (await authenticatedUser(request))?.email : null
 return NextResponse.json({role:"owner",email,integrations:[
  {name:"Gmail",configured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET)},
  {name:"WhatsApp",configured:Boolean(process.env.WHATSAPP_APP_SECRET)},
  {name:"OpenAI",configured:Boolean(process.env.OPENAI_API_KEY||process.env.OPEN_API_KEY)},
  {name:"Supabase",configured:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)}
 ],capabilities:[
  ["grounding","Resume + JD Grounding","MERGED",null],["evidence","Evidence Graph","MERGED","grounding"],
  ["interview","Interview Intelligence","MERGED",null],["voice","Voice Intelligence","FOUNDATION",null],
  ["transcribe","Transcribe","PLANNED","voice"],["live-share","Live Share","PLANNED","transcribe"],
  ["auto-transcribe","Auto Transcribe","PLANNED","transcribe"],["dictate","Dictate","PLANNED","voice"],
  ["speaker","Speaker Separation","FOUNDATION","transcribe"],["corrections","What Went Wrong","PLANNED","transcribe"],
  ["memory","Persistent Memory","FOUNDATION",null],["adaptation","Social Adaptation","FOUNDATION","memory"],
  ["prosody","Prosody","FOUNDATION","voice"],["turns","Turn Taking","FOUNDATION","voice"]
 ].map(([id,name,state,parent])=>({id,name,state,parent}))})
}
