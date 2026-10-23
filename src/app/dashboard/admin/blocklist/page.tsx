// Employer blocklist requests, for the owner to review. Sent from the public form on /responsible-use and kept one file
// each by src/lib/blocklist-request.ts. Read here on the server, by an admin only; nothing is blocked automatically.

import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/owner"
import { blob } from "@/lib/storage"
import { BLOCKLIST_PREFIX, type BlocklistRequest } from "@/lib/blocklist-request"

export const dynamic = "force-dynamic"

type Kept = BlocklistRequest & { id: string; receivedAt: string; status: string }
const SHOWN = 200

async function readRequests(): Promise<{ requests: Kept[]; total: number; unreadable: number }> {
  const keys = (await blob.list(BLOCKLIST_PREFIX).catch(() => [] as string[])).filter(k => k.endsWith(".json")).sort().reverse()
  let unreadable = 0
  const requests = (await Promise.all(keys.slice(0, SHOWN).map(async key => {
    try { return JSON.parse((await blob.getText(key)) || "") as Kept } catch { unreadable++; return null }
  }))).filter((r): r is Kept => r !== null)
  return { requests, total: keys.length, unreadable }
}

export default async function BlocklistRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/dashboard/admin/blocklist")
  if (!isAdminEmail(user.email)) redirect("/dashboard")

  const { requests, total, unreadable } = await readRequests()
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "8px 20px 60px" }}>
      <p className="mf-eyebrow">OWNER · RESPONSIBLE USE</p>
      <h1>Employer blocklist requests</h1>
      <p style={{ color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 640 }}>
        Sent from the form on <Link href="/responsible-use" style={{ color: "var(--accent)" }}>/responsible-use</Link>. Nothing is blocked
        automatically: read each one and reply to the email given. {total > SHOWN ? `Showing the newest ${SHOWN} of ${total}.` : `${total} in all.`}
        {unreadable > 0 && ` ${unreadable} could not be read.`}
      </p>
      {requests.length === 0 ? (
        <p style={{ marginTop: 24, color: "var(--text-soft)" }}>No requests yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0", display: "grid", gap: 12 }}>
          {requests.map(r => (
            <li key={r.id} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16, color: "var(--text)" }}>{r.company}{r.domain ? ` · ${r.domain}` : ""}</strong>
                <span style={{ fontSize: 13, color: "var(--text-soft)" }}>{new Date(r.receivedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })} · {r.status}</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--text-muted)" }}>
                {r.contactName}{r.contactRole ? `, ${r.contactRole}` : ""} · <a href={`mailto:${r.contactEmail}`} style={{ color: "var(--accent)" }}>{r.contactEmail}</a>
              </p>
              {r.details && <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>{r.details}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
