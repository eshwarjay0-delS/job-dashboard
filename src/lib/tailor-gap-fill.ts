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

/**
 * The initial split draft accepts any requested profile field. Repair paths
 * must use the same rule or a valid summary-only/headline-only response is
 * mistaken for an empty skills response and leaves pendingProfile set.
 */
export function hasProfilePartContent(
  edits: ProfilePartOutput,
  sections: ProfilePartSections,
): boolean {
  const hasSkills = sections.skills &&
    (edits.skills || []).some(item => String(item?.text ?? "").trim().length > 0)
  const hasSummary = sections.summary && String(edits.summary ?? "").trim().length > 0
  const hasHeadline = sections.headline &&
    `${edits.headline?.title ?? ""}${edits.headline?.tagline ?? ""}`.trim().length > 0
  return hasSkills || hasSummary || hasHeadline
}

/** Clear only the profile/role part that workParts actually accepted. */
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
