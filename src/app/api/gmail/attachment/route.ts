import { NextResponse } from "next/server"
import { requireAuth, isAuthContext } from "../_lib"
import { getGoogleWorkspaceAccessToken, listGoogleWorkspaceAccounts } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1"

// GET /api/gmail/attachment?messageId=X&attachmentId=Y&account=email@...
// Streams a Gmail attachment back as a download (used for the resume files
// shown at each hop of a submission's mind map).
export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) {
      return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    }
    const rl = checkRateLimit(`gmail-attachment:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const url = new URL(req.url)
    const messageId = url.searchParams.get("messageId")
    const attachmentId = url.searchParams.get("attachmentId")
    const filename = url.searchParams.get("filename") || "attachment"
    const accountEmail = (url.searchParams.get("account") || "").toLowerCase()
    if (!messageId || !attachmentId) {
      return NextResponse.json({ ok: false, error: "messageId and attachmentId required" }, { status: 400 })
    }

    const accounts = await listGoogleWorkspaceAccounts(ctx.userId)
    const ordered = [
      ...accounts.filter(a => (a.google_email || "").toLowerCase() === accountEmail),

    ]
    let data: any = null
    for (const a of ordered) {
      const token = await getGoogleWorkspaceAccessToken(ctx.userId, a.id).catch(() => null)
      if (!token) continue
      try {
        const res = await fetch(
          `${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) continue
        data = await res.json()
        break
      } catch { /* try next account */ }
    }
    if (!data?.data) return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 })

    const bytes = Buffer.from(data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    const safe = filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "attachment"
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    console.error("gmail/attachment error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
