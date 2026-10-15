/**
 * Who may open the admin pages.
 *
 * The owner, 2026-10-07: "Make this another nav for admin only eshwarjay0@gmail.com is the admin." An admin is a signed-in
 * person whose email the identity provider has confirmed and which is listed in ADMIN_EMAILS (src/lib/owner.ts). Nothing in
 * code names anyone: the list is a setting.
 *
 * The older shared login (ADMIN_USERNAME / ADMIN_PASSWORD, the `mf_admin` cookie) still opens the same doors where it is
 * configured. It is not configured on the live deployment, which is why the admin panel there had never been reachable.
 *
 * Every admin route asks this on the server. The sidebar asks /api/admin/me only to decide whether to SHOW the link: hiding a
 * link protects nothing, and nothing relies on it.
 */
import type { NextRequest } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { verifyAdminToken } from "@/lib/adminSession"
import { isAdminEmail } from "@/lib/owner"

export type AdminIdentity = { by: "email"; id: string } | { by: "shared-login" }

export async function adminOf(request: NextRequest): Promise<AdminIdentity | null> {
  if (verifyAdminToken(request.cookies.get("mf_admin")?.value)) return { by: "shared-login" }
  const user = await authenticatedUser(request)
  return user && isAdminEmail(user.email) ? { by: "email", id: user.id } : null
}
