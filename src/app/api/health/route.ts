import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Simple health check endpoint used by the Chrome extension to verify
// the MarketFit app is reachable before showing the tailor UI.
export async function GET() {
  return NextResponse.json({ ok: true, app: "MarketFit", ts: Date.now() })
}
