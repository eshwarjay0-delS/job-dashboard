import { NextResponse } from "next/server"
import { acceptSnapshotPart, authorizeSnapshotImport, snapshotBodyTooLarge } from "@/lib/gmailSnapshot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/gmail/snapshot-import
// Header x-import-secret must match GMAIL_SNAPSHOT_IMPORT_SECRET.
// Body: { user_id, part, total, sync (part 0 only), threads }.
// Each part is a private blob. Nothing here is listed or returned as a public URL.
export async function POST(req: Request) {
  const auth = authorizeSnapshotImport(req.headers.get("x-import-secret"))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: { "Cache-Control": "no-store" } })
  }
  const declared = Number(req.headers.get("content-length") || 0)
  if (declared && snapshotBodyTooLarge(declared)) {
    return NextResponse.json({ ok: false, error: "Snapshot part is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } })
  }
  const text = await req.text()
  if (snapshotBodyTooLarge(Buffer.byteLength(text))) {
    return NextResponse.json({ ok: false, error: "Snapshot part is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } })
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false, error: "Snapshot part must be JSON." }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const saved = await acceptSnapshotPart(body)
  return NextResponse.json(saved.body, { status: saved.status, headers: { "Cache-Control": "no-store" } })
}
