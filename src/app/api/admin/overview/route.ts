import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isOwnerEmail } from "@/lib/owner"
export const runtime="nodejs"; export const dynamic="force-dynamic"
export async function GET(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401})
 if(!isOwnerEmail(user.email))return NextResponse.json({error:"Owner access required."},{status:403})
 return NextResponse.json({role:"owner",email:user.email,integrations:[
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
