import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const HEADERS={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:HEADERS})
const KEY=/^([A-Za-z0-9:_-]{1,128}):(live|tx:[0-9]+)$/
function keyParts(s:unknown) {
  if(typeof s!=="string"||s.length>220)return null
  const m=s.match(KEY)
  return m?{id:m[1],key:s}:null
}
export async function GET(req:NextRequest) {
  const user=await authenticatedUser(req)
  if(!user)return json({ok:false,error:"Sign in to view account transcripts."},401)
  const key=keyParts(req.nextUrl.searchParams.get("key"))
  if(!key)return json({ok:false,error:"Invalid interview transcript."},400)
  try {
    const {data,error}=await createServiceClient().from("kompas_account_session_artifacts")
      .select("payload,captured_at").eq("user_id",user.id)
      .eq("session_id",key.id).eq("artifact_key",key.key).maybeSingle()
    if(error)throw error
    return json({ok:true,data:data?.payload||null,capturedAt:data?.captured_at||null})
  } catch {return json({ok:false,error:"Transcript could not be retrieved."},503)}
}
export async function POST(req:NextRequest) {
  const user=await authenticatedUser(req)
  if(!user)return json({ok:false,error:"Sign in to sync transcripts."},401)
  const limit=checkRateLimit("kompas-artifacts:"+user.id,{max:120,windowMs:60000})
  if(!limit.ok)return json({ok:false,error:"Sync requests temporarily limited."},429)
  if(Number(req.headers.get("content-length")||0)>2_000_000)return json({ok:false,error:"Transcript too large for one transfer."},413)
  const raw=await req.text().catch(()=>"")
  if(Buffer.byteLength(raw,"utf8")>2_000_000)return json({ok:false,error:"Transcript too large for one transfer."},413)
  let body:unknown;try{body=JSON.parse(raw)}catch{return json({ok:false,error:"Invalid transcript."},400)}
  const input=body&&typeof body==="object"?body as Record<string,unknown>:{}
  const key=keyParts(input.key)
  const payload=input.data
  if(!key||!payload||typeof payload!=="object"||Array.isArray(payload))return json({ok:false,error:"Invalid transcript key or data."},400)
  const at=typeof (payload as Record<string,unknown>).at==="number"?(payload as Record<string,unknown>).at:Date.now()
  if(typeof at!=="number"||!Number.isSafeInteger(at)||at<0)return json({ok:false,error:"Invalid snapshot date."},400)
  try {
    const {data,error}=await createServiceClient().rpc("save_kompas_account_artifact",{
      p_user_id:user.id,p_session_id:key.id,p_key:key.key,p_payload:payload,p_captured:at,
    })
    if(error)throw error
    return json({ok:true,saved:data})
  }catch{return json({ok:false,error:"Transcript kept locally; server sync will retry."},503)}
}
