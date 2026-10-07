import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isOwnerEmail } from "@/lib/owner"
export default async function HealthPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/dashboard/admin/health");if(!isOwnerEmail(user.email))redirect("/dashboard");return <div><p className="mf-eyebrow">OWNER · SYSTEM</p><h1>System health</h1><p>Runtime probes, deployment state, agent failures and latency belong here. Unknown state is displayed rather than guessed.</p></div>}
