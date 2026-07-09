import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Drive-connect callback — only reached when the user clicks "Connect Google Drive"
// in Settings. Saves the refresh token so the server can read/write their Drive.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session) {
      const session = data.session
      const user    = session.user

      if (session.provider_refresh_token) {
        try {
          await supabase.from("user_drive").upsert(
            {
              user_id:      user.id,
              refresh_token: session.provider_refresh_token,
              connected_at:  new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
        } catch { /* table not yet created */ }
      }

      // Redirect back to Settings with a success flag so the UI updates instantly
      return NextResponse.redirect(`${origin}/dashboard/settings?drive=connected`)
    }
  }

  return NextResponse.redirect(`${origin}/dashboard/settings?drive=error`)
}
