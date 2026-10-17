import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isAuthContext, fetchClassifiedThreads, threadsToMails } from "../_lib"
import { trackedSenders, setTracked } from "@/lib/mail-important-store"
import { validTracked } from "@/lib/mail-important"
import { checkRateLimit } from "@/lib/rateLimit"
export const dynamic="force-dynamic"
export const maxDuration=60
export async function GET(req:NextRequest) {
 const ctx=await requireAuth();if(!isAuthContext(ctx))return NextResponse.json({error:ctx.error},{status:ctx.status})
 try {
  const rules=await trackedSenders(ctx.userId)
  if(req.nextUrl.searchParams.get('messages')!=='1')return NextResponse.json({ok:true,rules})
  if(!checkRateLimit(`important:${ctx.userId}`,{max:6,windowMs:60000}).ok)return NextResponse.json({error:'Please wait before refreshing.'},{status:429})
  const results=await Promise.all(ctx.accounts.filter(a=>a.gmail_enabled).map(async a=>{
   const mine=rules.filter(r=>r.account===a.google_email.toLowerCase())
   if(!mine.length)return {threads:[],issues:[]}
   return fetchClassifiedThreads(ctx.userId,{account:a.google_email,days:90,max:100,query:`{${mine.map(r=>`from:"${r.email}"`).join(' ')}}`})
  }))
  return NextResponse.json({ok:true,rules,mails:threadsToMails(results.flatMap(r=>r.threads)),issues:results.flatMap(r=>r.issues),scope:'Most recent 100 matching threads per inbox within 90 days.'},{headers:{'Cache-Control':'private, no-store'}})
 } catch {return NextResponse.json({error:'Tracked mail could not be read. Please retry.'},{status:500})}
}
export async function POST(req:NextRequest) {
 if(req.headers.get('sec-fetch-site')==='cross-site' || (req.headers.get('origin') && req.headers.get('origin')!==req.nextUrl.origin))return NextResponse.json({error:'Invalid origin'},{status:403})
 const ctx=await requireAuth();if(!isAuthContext(ctx))return NextResponse.json({error:ctx.error},{status:ctx.status})
 const b=await req.json().catch(()=>null)
 const rule={account:String(b?.account||'').toLowerCase(),email:String(b?.email||'').toLowerCase(),name:String(b?.name||'').slice(0,160),at:Date.now()}
 if(!validTracked(rule)||typeof b?.on!=='boolean'||!ctx.accounts.some(a=>a.google_email.toLowerCase()===rule.account))return NextResponse.json({error:'Choose a sender in a connected inbox.'},{status:400})
 try { const existing=await trackedSenders(ctx.userId);if(b.on && existing.length>=200 && !existing.some(r=>r.account===rule.account&&r.email===rule.email))return NextResponse.json({error:'Tracking limit reached. Remove a sender first.'},{status:409});await setTracked(ctx.userId,rule,b.on);return NextResponse.json({ok:true,rules:await trackedSenders(ctx.userId)}) } catch{return NextResponse.json({error:'Could not save tracking. Please retry.'},{status:500})}
}
