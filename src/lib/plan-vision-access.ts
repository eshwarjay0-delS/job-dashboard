import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { authenticatedUser } from "@/lib/authBoundary"
import { verifyAdminToken } from "@/lib/adminSession"
import { isAdminEmail } from "@/lib/owner"

export async function requireVisionAdmin() {
  if (!verifyAdminToken((await cookies()).get("mf_admin")?.value)) {
    const user = await authenticatedUser()
    if (!user) redirect("/login?next=/dashboard/admin/vision")
    if (!isAdminEmail(user.email)) redirect("/dashboard")
  }
}
