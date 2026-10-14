// Explicit resume-only test entitlement. This grants no admin privileges.
export function hasUnlimitedResumeTestAccess(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === "janjiaarya@gmail.com"
}
