import { NextRequest, NextResponse } from "next/server"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"
const KEY = "waitlist.jsonl"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email || "").trim().toLowerCase()
    const plan  = (body.plan  || "starter").trim()
    const ref   = (body.ref   || "").trim()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 })
    }

    // Deduplicate — don't count same email twice
    const existing = (await blob.getText(KEY)) || ""
    const duplicate = existing.split("\n").some(line => {
      try { return JSON.parse(line).email === email } catch { return false }
    })

    const entry = JSON.stringify({ ts: new Date().toISOString(), email, plan, ref, duplicate }) + "\n"
    // Object stores have no append → read-modify-write.
    await blob.put(KEY, existing + entry)

    return NextResponse.json({
      ok: true,
      duplicate,
      message: duplicate
        ? "You're already on the list! We'll reach out soon."
        : "You're on the waitlist! We'll be in touch.",
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Admin-only count — require the same admin token used by /api/admin/auth
  const adminPass = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || ""
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token") ?? ""
  if (token !== adminPass) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const content = (await blob.getText(KEY)) || ""
    const entries = content.split("\n").filter(l => {
      try { const p = JSON.parse(l); return p.email && !p.duplicate } catch { return false }
    })
    return NextResponse.json({ count: entries.length })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
