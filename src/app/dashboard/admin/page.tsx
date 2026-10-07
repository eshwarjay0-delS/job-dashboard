import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isOwnerEmail } from "@/lib/owner"
import { KOMPAS_CAPABILITIES } from "@/lib/kompas-evolution"

const states = ["VERIFIED","DEPLOYED","MERGED","PR OPEN","CODED","FOUNDATION","PLANNED"] as const
function Card({title,value,note}:{title:string;value:string;note:string}){return <article style={{border:"1px solid var(--border-strong)",padding:18,background:"var(--surface-1)"}}><div className="ink-label">{title}</div><div style={{fontSize:30,fontWeight:700,margin:"8px 0"}}>{value}</div><div style={{fontSize:13,opacity:.72}}>{note}</div></article>}
export default async function AdminPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect("/login?next=/dashboard/admin");if(!isOwnerEmail(user.email))redirect("/dashboard")
 const counts=Object.fromEntries(states.map(s=>[s,KOMPAS_CAPABILITIES.filter(c=>c.state===s).length]))
 const maturity=Math.round(KOMPAS_CAPABILITIES.filter(c=>c.state==="VERIFIED").length/Math.max(1,KOMPAS_CAPABILITIES.length)*100)
 return <div style={{maxWidth:1200,margin:"0 auto"}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"end",marginBottom:28}}><div><p className="mf-eyebrow">OWNER CONTROL PLANE</p><h1 style={{marginBottom:8}}>Admin</h1><p style={{margin:0,opacity:.72}}>System truth, integrations, AI economics and Kompas evolution.</p></div><Link href="/dashboard">User dashboard</Link></header>
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:28}}>
   <Card title="Kompas maturity" value={maturity+"%"} note="Verified capabilities only. No invented confidence."/><Card title="Capabilities" value={String(KOMPAS_CAPABILITIES.length)} note="Canonical evolution registry"/><Card title="Verified" value={String(counts["VERIFIED"])} note="Production verified"/><Card title="In progress" value={String((counts["FOUNDATION"]||0)+(counts["CODED"]||0)+(counts["PR OPEN"]||0))} note="Foundation through open PR"/>
  </section>
  <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:32}}>
   {[["AI Usage & Cost","Live estimate, provider reconciliation and operation ledger.","/dashboard/admin/usage"],["Integrations","Gmail, WhatsApp and connection health.","/dashboard/admin/integrations"],["Kompas Evolution","Capability map, implementation state and history.","#evolution"],["System Health","Failures, latency, agents and deployment state.","/dashboard/admin/health"]].map(([t,d,h])=><Link key={t} href={h} style={{border:"1px solid var(--border-strong)",padding:18,textDecoration:"none",color:"inherit",background:"var(--surface-1)"}}><strong>{t}</strong><p style={{fontSize:13,opacity:.7,marginBottom:0}}>{d}</p></Link>)}
  </section>
  <section id="evolution"><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:14}}><div><p className="mf-eyebrow">KOMPAS EVOLUTION</p><h2 style={{margin:0}}>Living capability map</h2></div><span style={{fontSize:12,opacity:.7}}>Canonical capability registry</span></div>
   <div style={{overflowX:"auto",border:"1px solid var(--border-strong)",background:"var(--surface-1)"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr>{["Capability","Area","State","Repository","What it means"].map(h=><th key={h} style={{textAlign:"left",padding:12,borderBottom:"1px solid var(--border-strong)",fontSize:12}}>{h}</th>)}</tr></thead><tbody>{KOMPAS_CAPABILITIES.map(cap=><tr key={cap.id}><td style={{padding:12,borderBottom:"1px solid var(--border)"}}><strong>{cap.label}</strong>{cap.parent&&<div style={{fontSize:11,opacity:.55}}>under {cap.parent}</div>}</td><td style={{padding:12,borderBottom:"1px solid var(--border)"}}>{cap.area}</td><td style={{padding:12,borderBottom:"1px solid var(--border)"}}><code>{cap.state}</code></td><td style={{padding:12,borderBottom:"1px solid var(--border)"}}>{cap.repo}</td><td style={{padding:12,borderBottom:"1px solid var(--border)",fontSize:13,opacity:.78}}>{cap.description}</td></tr>)}</tbody></table></div>
  </section>
 </div>
}
