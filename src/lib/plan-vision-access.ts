import { redirect } from "next/navigation"
import { adminOf } from "@/lib/adminAccess"
import { authenticatedUser } from "@/lib/authBoundary"

export async function requireVisionAdmin() {
  if (await adminOf()) return
  const user = await authenticatedUser()
  if (!user || user.synthetic) redirect("/login?next=/dashboard/admin/vision")
  redirect("/dashboard")
}
