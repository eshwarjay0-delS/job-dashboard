"use client"
import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { senderEmail } from "@/lib/mail-reading"
import type { History } from "@/lib/mail-papers"
import type { Mail } from "../../_suite/sample"
export default function ContactCard({mail}:{mail:Mail}) {
 const [history,setHistory]=useState<History|null>(null),[error,setError]=useState('')
 useEffect(()=>{const controller=new AbortController();fetch('/api/gmail/person',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:senderEmail(mail.fromEmail),account:mail.account}),signal:controller.signal}).then(r=>r.json()).then(j=>{if(!controller.signal.aborted){if(j.ok)setHistory(j);else setError(j.error||'Contact history unavailable')}}).catch(()=>{if(!controller.signal.aborted)setError('Contact history unavailable')});return()=>controller.abort()},[mail.account,mail.fromEmail])
 const person=history?.person
 return <section aria-label="Contact details"><h2 style={{fontSize:18,marginTop:0}}>Contact details</h2><dl style={{margin:0}}>{[['Full name',person?.name && person.name !== person.email.split('@')[0] ? person.name : ''],['Email',senderEmail(mail.fromEmail)],['Mobile number',person?.phones.join(', ')||''],['Receiving inbox',mail.account],['Messages received',history?String(history.theirs):'']].map(([label,value])=><div key={label} style={{marginBottom:12}}><dt style={{fontSize:12,color:'var(--text-muted)'}}>{label}</dt><dd style={{margin:0,minHeight:22,overflowWrap:'anywhere'}}>{value}</dd></div>)}</dl><h3 style={{fontSize:14}}>Interaction history</h3><p style={{fontSize:12,color:'var(--text-muted)'}}>From retained mail in this inbox, up to 90 days.</p>{error&&<p role="status">{error}</p>}{history?.conversations.map(c=><a key={c.account+':'+c.threadId} href={`/dashboard/mail?open=${encodeURIComponent(c.threadId)}&account=${encodeURIComponent(c.account)}`} style={{display:'block',borderTop:'1px solid var(--border)',padding:'10px 0',color:'var(--text)',textDecoration:'none'}}><strong style={{fontSize:13}}>{c.subject}</strong><small style={{display:'flex',gap:5,alignItems:'center',color:'var(--text-muted)'}}><Clock size={12}/>{c.lastAt?new Date(c.lastAt).toLocaleString():''}</small></a>)}</section>
}
