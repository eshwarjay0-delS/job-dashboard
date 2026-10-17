"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Star } from "lucide-react"
import type { Mail } from "../../_suite/sample"
export default function ImportantMail() {
 const [mails,setMails]=useState<Mail[]>([]),[note,setNote]=useState('Loading tracked mail…')
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/gmail/important?messages=1',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);if(active){setMails(j.mails||[]);setNote(j.issues?.length?j.issues.map((i:{account:string;reason:string})=>`${i.account}: ${i.reason}`).join(' · '):j.rules?.length?'Most recent matching mail · up to 90 days.':'Mark a sender important in Gmail to track their incoming messages here.')}}catch(e){if(active)setNote(e instanceof Error?e.message:'Tracked mail unavailable')}};void load();window.addEventListener('mfit-important',load);return()=>{active=false;window.removeEventListener('mfit-important',load)}},[])
 return <section className="mf-home-section" aria-label="Important mail" style={{margin:'20px 0',padding:20,border:'1px solid var(--border)',borderRadius:16,background:'var(--surface)'}}><h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:18}}><Star size={18}/>Important</h2><p style={{color:'var(--text-muted)',fontSize:13}} role="status">{note}</p>{mails.slice(0,12).map(m=><Link key={m.account+':'+m.id} href={`/dashboard/mail?open=${encodeURIComponent(m.id)}&account=${encodeURIComponent(m.account)}`} style={{display:'block',padding:'10px 0',borderTop:'1px solid var(--border)',textDecoration:'none',color:'var(--text)'}}><strong>{m.subject}</strong><small style={{display:'block',color:'var(--text-muted)'}}>{m.from} · {m.account}</small></Link>)}<Link href="/dashboard/mail">Open Gmail →</Link></section>
}
