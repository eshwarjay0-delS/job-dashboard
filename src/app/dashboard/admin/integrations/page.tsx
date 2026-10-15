import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isOwnerEmail } from "@/lib/owner"

export default async function AdminIntegrationsPage(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
 if(!user) redirect("/login?next=/dashboard/admin/integrations"); if(!isOwnerEmail(user.email)) redirect("/dashboard")
 const services=[
  ["Gmail","Connection state must come from the actual OAuth grant. Never infer connected from account knowledge."],
  ["WhatsApp","Owner binding and webhook health are shown independently."],
  ["OpenAI","Runtime key presence is not billing reconciliation. Usage requires the organization cost ledger."],
 ]
 return <div style={{maxWidth:900}}><p className="mf-eyebrow">OWNER · INTEGRATIONS</p><h1>Integration registry</h1><p>One place to see actual connection state. Unknown stays unknown until the service proves otherwise.</p><div style={{display:"grid",gap:12,marginTop:24}}>{services.map(([n,d])=><article key={n} style={{border:"1px solid var(--border-strong)",padding:18}}><h2 style={{marginTop:0}}>{n}</h2><p>{d}</p><code>STATE: NEEDS LIVE PROBE</code></article>)}</div></div>
}
