export type ProfilePartSections = {
  skills: boolean
  summary: boolean
  headline: boolean
}

export type ProfilePartOutput = {
  skills?: Array<{ text?: string | null }>
  summary?: string | null
  headline?: { title?: string | null; tagline?: string | null } | null
}

export type PendingDraftPartState = {
  failed: number
  total: number
  pendingRoles?: number[]
  pendingProfile?: boolean
}

type ProfileTextFields = Pick<ProfilePartOutput, "summary" | "headline">

/**
 * All three profile fields belong to one logical draft part. A summary-only or
 * headline-only response is valid when that section is requested; checking only
 * skills incorrectly discards it and leaves the profile marked pending.
 */
export function hasProfilePartContent(
  edits: ProfilePartOutput,
  sections: ProfilePartSections,
): boolean {
  const hasSkills = sections.skills &&
    (edits.skills || []).some(item => String(item?.text ?? "").trim().length > 0)
  const hasSummary = sections.summary && String(edits.summary ?? "").trim().length > 0
  const hasHeadline = sections.headline &&
    Boolean(String(edits.headline?.title ?? "").trim() || String(edits.headline?.tagline ?? "").trim())
  return hasSkills || hasSummary || hasHeadline
}

/** Merge only requested, non-empty summary/headline fields; keep the other profile data. */
export function mergeProfileTextFields<T extends ProfileTextFields>(
  current: T,
  incoming: ProfileTextFields,
  sections: ProfilePartSections,
): T {
  const summary = sections.summary && typeof incoming.summary === "string" && incoming.summary.trim()
    ? incoming.summary
    : current.summary
  const hasHeadline = sections.headline && Boolean(
    String(incoming.headline?.title ?? "").trim() || String(incoming.headline?.tagline ?? "").trim(),
  )
  const incomingTitle = String(incoming.headline?.title ?? "").trim()
  const incomingTagline = String(incoming.headline?.tagline ?? "").trim()
  const headline = hasHeadline
    ? {
        ...(current.headline ?? {}),
        ...(incomingTitle ? { title: incoming.headline?.title } : {}),
        ...(incomingTagline ? { tagline: incoming.headline?.tagline } : {}),
      }
    : current.headline
  return { ...current, summary, headline } as T
}

/** Clear only the profile or employer-role part that was actually accepted. */
export function resolvePendingDraftPart(
  partial: PendingDraftPartState | undefined,
  roleIndex: number,
): PendingDraftPartState | undefined {
  if (!partial) return undefined
  const pendingRoles = (partial.pendingRoles || []).filter(index => index !== roleIndex)
  const pendingProfile = Boolean(partial.pendingProfile) && roleIndex !== -1
  const failed = pendingRoles.length + Number(pendingProfile)
  return failed ? { ...partial, failed, pendingRoles, pendingProfile } : undefined
}
