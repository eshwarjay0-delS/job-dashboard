import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/gmail/unfollowed — list unfollowed companies/domains
// POST /api/gmail/unfollowed { domain, company_name?, reason? } — add
// DELETE /api/gmail/unfollowed?domain=... — remove (re-follow)

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 })

    // Existing rules remain user controlled; GET never recreates deleted rules.

    const { data, error } = await supabase
      .from("unfollowed_domains")
      .select("id, domain, company_name, reason, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
    if (error) throw error

    return NextResponse.json({ ok: true, domains: data || [] })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const domain = String(body.domain || "").trim().toLowerCase().replace(/^@/, "")
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 })
    }

    const { error } = await supabase.from("unfollowed_domains").upsert(
      {
        user_id: session.user.id,
        domain,
        company_name: String(body.company_name || domain.split(".")[0]),
        reason: String(body.reason || ""),
      },
      { onConflict: "user_id,domain" },
    )
    if (error) throw error

    return NextResponse.json({ ok: true, domain })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 })

    const domain = new URL(req.url).searchParams.get("domain")?.trim().toLowerCase()
    if (!domain) return NextResponse.json({ ok: false, error: "Missing domain" }, { status: 400 })

    const { error } = await supabase
      .from("unfollowed_domains")
      .delete()
      .eq("user_id", session.user.id)
      .eq("domain", domain)
    if (error) throw error

    return NextResponse.json({ ok: true, domain })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
