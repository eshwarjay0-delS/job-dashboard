import { NextRequest, NextResponse } from "next/server"
import { addFeedback, recentFeedback } from "@/lib/feedback"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// Stored feedback is folded directly into the AI tailoring prompt for every
// future user tailoring a resume in the same category (see src/lib/tailor.ts
// storedFeedback/allPrefs) — an unauthenticated POST here is a persistent
// prompt-injection vector, so writes require a real signed-in user. GET stays
// open (read-only, only surfaces existing entries, no injection risk).
async function requireUser() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ?? null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const category = new URL(request.url).searchParams.get("category") || ""
  return NextResponse.json({ recent: await recentFeedback(category, 6) })
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const chips: string[] = Array.isArray(body.chips) ? body.chips : []
  const custom = (body.custom || "").trim()
  const category = (body.category || "").toString()
  const items = [...chips, custom].filter(Boolean)
  if (!items.length) return NextResponse.json({ error: "No feedback to save." }, { status: 400 })
  await addFeedback(items, category)
  return NextResponse.json({ saved: items.length })
}
