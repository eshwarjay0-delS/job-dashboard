// One source of truth for the resume-only dashboard entitlement.
// Preserve the original two test accounts, and support any account assigned a resume-only subscription.
// This is presentation/routing only: it does not grant admin or unlimited credits.
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const RESUME_ONLY_TEST_EMAILS = new Set(["janjiaarya@gmail.com", "tryguessup@gmail.com"])
const RESUME_PLANS = new Set(["resume", "resume_only", "resume-only", "resume_prep", "resume_preparation"])
const ACTIVE_STATUSES = new Set(["active", "trialing"])

export function isResumeOnlyTestEmail(email: string | null | undefined): boolean {
  return RESUME_ONLY_TEST_EMAILS.has(String(email || "").trim().toLowerCase())
}

export function isResumeOnlyPlan(planKey: string | null | undefined, status: string | null | undefined): boolean {
  return RESUME_PLANS.has(String(planKey || "").trim().toLowerCase())
    && ACTIVE_STATUSES.has(String(status || "").trim().toLowerCase())
}

export async function isResumeOnlyAccount(user: { id: string; email: string | null } | null): Promise<boolean> {
  if (!user) return false
  if (isResumeOnlyTestEmail(user.email)) return true
  if (!serviceClientAvailable()) return false
  try {
    const { data, error } = await createServiceClient()
      .from("subscription_accounts")
      .select("plan_key,status")
      .eq("user_id", user.id)
      .maybeSingle()
    return !error && isResumeOnlyPlan(data?.plan_key, data?.status)
  } catch {
    return false
  }
}
