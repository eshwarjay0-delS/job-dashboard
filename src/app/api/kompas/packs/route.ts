import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { listPacks, OWNER_RESUME } from "@/lib/kompasPacks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store" }

// Static subject packs for the Roles and Categories pages. Skip-login reaches
// this as the Houston owner. The sample answers stay on the answer route.
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: HEADERS })
  }
  const packs = listPacks().map((pack) => ({
    id: pack.id,
    kind: pack.kind,
    title: pack.title,
    blurb: pack.blurb,
    dossier: pack.dossier,
    mustMention: pack.mustMention,
    avoid: pack.avoid,
    checklist: pack.checklist,
    notebookLmUrl: pack.notebookLmUrl,
  }))
  return NextResponse.json({ ownerResume: OWNER_RESUME, packs }, { headers: HEADERS })
}
