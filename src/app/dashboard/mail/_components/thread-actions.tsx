"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Star } from "lucide-react"
import { senderEmail } from "@/lib/mail-reading"
import { trackedBy, type TrackedSender } from "@/lib/mail-important"
import { clampMenuPosition } from "@/lib/menu-position"
import type { Mail } from "../../_suite/sample"
export function useTrackedSenders(){const [rules,setRules]=useState<TrackedSender[]>([]);useEffect(()=>{let active=true;const load=()=>fetch('/api/gmail/important').then(r=>r.json()).then(j=>{if(active&&j.ok)setRules(j.rules)}).catch(()=>{});void load();window.addEventListener('mfit-important',load);return()=>{active=false;window.removeEventListener('mfit-important',load)}},[]);return rules}
export default function ThreadActions({mail,rules}:{mail:Mail;rules:TrackedSender[]}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const [open,setOpen]=useState(false);const [pos,setPos]=useState<{left:number;top:number;width:number}|null>(null);const box=useRef<HTMLSpanElement|null>(null)
 const email=senderEmail(mail.fromEmail),on=trackedBy(rules,mail.account,email)
 const measure=()=>{const el=box.current;if(!el||typeof window==='undefined')return;const r=el.getBoundingClientRect();setPos(clampMenuPosition({left:r.left,top:r.top,bottom:r.bottom,width:r.width},{width:window.innerWidth,height:window.innerHeight},{width:260,height:200}))}
 useEffect(()=>{if(!open)return;const away=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false)};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('mousedown',away);document.addEventListener('keydown',esc);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);return()=>{document.removeEventListener('mousedown',away);document.removeEventListener('keydown',esc);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true)}},[open])
 async function toggle(){setBusy(true);setError('');try{const r=await fetch('/api/gmail/important',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:mail.account,email,name:mail.from,on:!on})});const j=await r.json();if(!r.ok)throw Error(j.error);window.dispatchEvent(new Event('mfit-important'))}catch(e){setError(e instanceof Error?e.message:'Could not save')}finally{setBusy(false)}}
 // The panel is positioned against the viewport, not the list fold: the
 // old dropdown inside the scrollable list fold could be clipped by the
 // fold, and its items were under 44px tall. Fixed, clamped to the
 // viewport, every item at least 44px tall.
 return <span ref={box} style={{position:'relative',flexShrink:0,marginTop:14}}><button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${mail.subject}`} onClick={()=>{if(!open)measure();setOpen(v=>!v)}} style={{cursor:'pointer',background:'transparent',border:0,color:'var(--text)',minHeight:44,minWidth:44,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0}}>{on?<Star size={18} fill="currentColor"/>:<MoreHorizontal size={20}/>}</button>{open&&<div role="menu" style={{position:'fixed',left:pos?.left??12,top:pos?.top??120,width:pos?.width??260,maxWidth:'min(260px, calc(100vw - 24px))',zIndex:9999,padding:12,border:'1px solid var(--border-strong)',background:'var(--surface)',borderRadius:10,boxShadow:'var(--shadow-card)'}}><button className="btn-ghost" disabled={busy} onClick={toggle} style={{minHeight:44,width:'100%',justifyContent:'flex-start'}}>{on?'Stop tracking sender':'Mark important · track sender'}</button><Link style={{display:'flex',alignItems:'center',minHeight:44,padding:'0 8px',color:'var(--accent)'}} href={`/dashboard/workflows?thread=${encodeURIComponent(mail.id)}&account=${encodeURIComponent(mail.account)}&sender=${encodeURIComponent(email)}`}>Send to automation</Link><small style={{display:'block'}}>Important tracks future mail from this sender in this inbox.</small>{error&&<p role="alert">{error}</p>}</div>}</span>
}
