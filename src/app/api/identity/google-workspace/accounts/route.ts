import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { decryptSecret } from "@/lib/secretCrypto"
import { loadWorkspaceAccounts } from "@/lib/gmailSnapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const loaded = await loadWorkspaceAccounts(user.id)
  return NextResponse.json({
    accounts: loaded.accounts,
    maxAccounts: 4,
    canAdd: loaded.source === "supabase" && loaded.accounts.length < 4,
    ...(loaded.notice ? { snapshotNotice: loaded.notice } : {}),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const accountId = String(body.accountId || "")
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.rpc("identity_set_primary_google_workspace_account", {
    p_user_id: user.id,
    p_account_id: accountId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const accountId = String(body.accountId || "")
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 })

  const service = createServiceClient()
  const { data } = await service.rpc("identity_get_google_workspace_account", {
    p_user_id: user.id,
    p_account_id: accountId,
  })
  const row = Array.isArray(data) ? data[0] : data
  if (row?.refresh_token_ciphertext) {
    try {
      const token = decryptSecret(String(row.refresh_token_ciphertext))
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      // Google revocation is best effort; removing local access still proceeds.
    }
  }

  const { error } = await service.rpc("identity_disconnect_google_workspace_account", {
    p_user_id: user.id,
    p_account_id: accountId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
