import { NextResponse } from "next/server"
import { requireAuth, isAuthContext } from "../_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

interface DraftStub { id: string; message: { id: string; threadId: string } }
interface DraftFull {
  id: string
  message: {
    id: string
    threadId: string
    snippet: string
    payload?: { headers: Array<{ name: string; value: string }> }
  }
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/gmail/drafts — the user's Gmail drafts across connected accounts.
// This is the "I started it, I haven't sent it" pile: RTR replies, rate
// confirmations, follow-ups waiting for his tap.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }
    const rl = checkRateLimit(`gmail-drafts:${ctx.userId}`, { max: 10, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
    const enabled = accounts.filter(a => a.gmail_enabled)
    const drafts: Array<{
      id: string; threadId: string; account: string
      to: string; subject: string; snippet: string
    }> = []

    for (const acct of enabled) {
      let token: string | null = null
      try {
        token = await getGoogleWorkspaceAccessToken(ctx.userId, acct.id)
      } catch { continue }
      if (!token) continue

      let list: { drafts?: DraftStub[] }
      try {
        const res = await fetch(`${GMAIL_API}/drafts?maxResults=20`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) continue
        list = await res.json()
      } catch { continue }

      for (const stub of list.drafts || []) {
        try {
          const res = await fetch(
            `${GMAIL_API}/drafts/${stub.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!res.ok) continue
          const full = (await res.json()) as DraftFull
          const headers = full.message.payload?.headers
          drafts.push({
            id: full.id,
            threadId: full.message.threadId,
            account: acct.google_email,
            to: header(headers, "To"),
            subject: header(headers, "Subject") || "(no subject)",
            snippet: full.message.snippet || "",
          })
        } catch { /* one bad draft shouldn't kill the list */ }
      }
    }

    return NextResponse.json({ ok: true, count: drafts.length, drafts })
  } catch (err) {
    console.error("gmail/drafts error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
