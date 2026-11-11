import { NextRequest, NextResponse } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { authenticatedUser } from "@/lib/authBoundary"
import { isOwnerEmail } from "@/lib/owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await adminOf(request)
  if (admin) {
    if (admin.by === "shared-login") {
      return NextResponse.json({ authenticated: true, owner: true, role: "owner" })
    }
    const user = await authenticatedUser(request)
    const owner = isOwnerEmail(user?.email)
    return NextResponse.json(
      { authenticated: true, owner, role: owner ? "owner" : "user" },
      { status: owner ? 200 : 403 },
    )
  }
  const user = await authenticatedUser(request)
  if (!user || user.synthetic) return NextResponse.json({ authenticated: false, owner: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, owner: false, role: "user" }, { status: 403 })
}
