"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Star } from "lucide-react"
import { senderEmail } from "@/lib/mail-reading"
import { trackedBy, type TrackedSender } from "@/lib/mail-important"
import type { Mail } from "../../_suite/sample"
export function useTrackedSenders(){const [rules,setRules]=useState<TrackedSender[]>([]);useEffect(()=>{let active=true;const load=()=>fetch('/api/gmail/important').then(r=>r.json()).then(j=>{if(active&&j.ok)setRules(j.rules)}).catch(()=>{});void load();window.addEventListener('mfit-important',load);return()=>{active=false;window.removeEventListener('mfit-important',load)}},[]);return rules}
export default function ThreadActions({mail,rules}:{mail:Mail;rules:TrackedSender[]}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const email=senderEmail(mail.fromEmail),on=trackedBy(rules,mail.account,email)
 async function toggle(){setBusy(true);setError('');try{const r=await fetch('/api/gmail/important',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:mail.account,email,name:mail.from,on:!on})});const j=await r.json();if(!r.ok)throw Error(j.error);window.dispatchEvent(new Event('mfit-important'))}catch(e){setError(e instanceof Error?e.message:'Could not save')}finally{setBusy(false)}}
 return <details style={{position:'relative',flexShrink:0,marginTop:14}}><summary aria-label={`Actions for ${mail.subject}`} style={{cursor:'pointer',listStyle:'none'}}>{on?<Star size={18} fill="currentColor"/>:<MoreHorizontal size={20}/>}</summary><div style={{position:'absolute',right:0,top:25,zIndex:5,width:230,padding:12,border:'1px solid var(--border-strong)',background:'var(--surface)',borderRadius:10,boxShadow:'var(--shadow-card)'}}><button className="btn-ghost" disabled={busy} onClick={toggle}>{on?'Stop tracking sender':'Mark important · track sender'}</button><Link style={{display:'block',padding:8,color:'var(--accent)'}} href={`/dashboard/workflows?thread=${encodeURIComponent(mail.id)}&account=${encodeURIComponent(mail.account)}&sender=${encodeURIComponent(email)}`}>Send to automation</Link><small style={{display:'block'}}>Important tracks future mail from this sender in this inbox.</small>{error&&<p role="alert">{error}</p>}</div></details>
}
