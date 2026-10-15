import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/me — is the person asking an admin? One boolean, for the sidebar to decide whether to show the Admin link and
// for the setup check to leave an admin alone. It says nothing about who the admins are, and it guards nothing by itself:
// every admin route asks adminOf() again on the server.
export async function GET(request: NextRequest) {
  const admin = await adminOf(request).catch(() => null)
  return NextResponse.json({ admin: admin !== null }, { headers: { "Cache-Control": "no-store" } })
}
