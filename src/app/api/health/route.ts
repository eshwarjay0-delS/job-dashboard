import { NextResponse } from "next/server"

export const runtime = "nodejs"

const HEADERS = {
  // Public stamp only: no user data. Short CDN cache cuts origin hits from uptime checks.
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
}

// Simple health check endpoint used by the Chrome extension to verify
// the MarketFit app is reachable before showing the tailor UI.
export async function GET() {
  return NextResponse.json({ ok: true, app: "MarketFit" }, { headers: HEADERS })
}
