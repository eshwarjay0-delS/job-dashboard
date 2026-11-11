import { redirect } from "next/navigation"
import { isAuthDisabled } from "@/lib/authDisabled"
import { adminOf } from "@/lib/adminAccess"
import { authenticatedUser } from "@/lib/authBoundary"

export async function requireVisionAdmin() {
  if (await adminOf()) return
  const user = await authenticatedUser()
  if (isAuthDisabled() || user?.synthetic) redirect("/dashboard")
  if (!user) redirect("/login?next=/dashboard/admin/vision")
  redirect("/dashboard")
}
