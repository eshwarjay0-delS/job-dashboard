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
 * The synthetic owner created when AUTH_DISABLED is on is never an admin. Admin routes need a real session or the
 * shared admin login cookie.
 *
 * Every admin route asks this on the server. The sidebar asks /api/admin/me only to decide whether to SHOW the link: hiding a
 * link protects nothing, and nothing relies on it.
 */
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { verifyAdminToken } from "@/lib/adminSession"
import { isAdminEmail } from "@/lib/owner"

export type AdminIdentity = { by: "email"; id: string } | { by: "shared-login" }

export async function adminOf(request?: NextRequest): Promise<AdminIdentity | null> {
  const readCookie = async (name: string) => {
    if (request) return request.cookies.get(name)?.value
    try { return (await cookies()).get(name)?.value } catch { return undefined }
  }
  if (verifyAdminToken(await readCookie("mf_admin"))) return { by: "shared-login" }
  const user = await authenticatedUser(request)
  if (!user || user.synthetic) return null
  return isAdminEmail(user.email) ? { by: "email", id: user.id } : null
}

/** Server pages: a real admin session or the shared admin login only. The synthetic owner is sent to sign-in. */
export async function requireAdminPage(next: string): Promise<AdminIdentity> {
  const admin = await adminOf()
  if (admin) return admin
  const user = await authenticatedUser()
  if (!user || user.synthetic) redirect(`/login?next=${next}`)
  redirect("/dashboard")
}
