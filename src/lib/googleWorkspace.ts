import { createServiceClient } from "@/lib/supabase/service"
import { decryptSecret } from "@/lib/secretCrypto"

export type GoogleWorkspaceAccount = {
  id: string
  google_email: string
  granted_scopes: string[]
  gmail_enabled: boolean
  calendar_enabled: boolean
  is_primary: boolean
  last_gmail_sync_at: string | null
  last_calendar_sync_at: string | null
  connected_at: string
  updated_at: string
}

export async function listGoogleWorkspaceAccounts(userId: string): Promise<GoogleWorkspaceAccount[]> {
  const service = createServiceClient()
  const { data, error } = await service.rpc("identity_list_google_workspace_accounts", { p_user_id: userId })
  if (error) throw new Error(error.message)
  return (data || []) as GoogleWorkspaceAccount[]
}

export async function getGoogleWorkspaceAccessToken(
  userId: string,
  accountId?: string | null,
): Promise<string | null> {
  const service = createServiceClient()
  const { data, error } = await service.rpc("identity_get_google_workspace_account", {
    p_user_id: userId,
    p_account_id: accountId || null,
  })
  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.refresh_token_ciphertext) return null

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Google Workspace refresh is not configured on the server.")

  const refreshToken = decryptSecret(String(row.refresh_token_ciphertext))
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) return null
  return String(body.access_token)
}
