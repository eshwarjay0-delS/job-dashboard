import { requireAdminPage } from "@/lib/adminAccess"
export default async function HealthPage(){
  await requireAdminPage("/dashboard/admin/health")
  return <div><p className="mf-eyebrow">OWNER · SYSTEM</p><h1>System health</h1><p>Runtime probes, deployment state, agent failures and latency belong here. Unknown state is displayed rather than guessed.</p></div>
}
