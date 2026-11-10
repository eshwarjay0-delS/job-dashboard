import path from "path"

export type RecoveryFilesContext = {
  userDir: string
  email: string
  said: string
  depth: number
  rel: string
  abs: string
  redo?: boolean
}

export type RecoveryResumeContext =
  | { ok: true; location: "library" | "inbox"; userResumeDir: string; files?: RecoveryFilesContext }
  | { ok: false }

/**
 * A recovery job may switch from its ephemeral inbox copy to the durable original
 * saved in the user's library. Resolve the path against the current account roots
 * before passing it back to the tailor; never let a stale serialized root authorize
 * a sibling account or an arbitrary filesystem path.
 */
export function resolveRecoveryResumeContext(input: {
  resumePath: string
  userId: string
  userResumesRoot: string
  inboxRoot: string
  files?: RecoveryFilesContext
}): RecoveryResumeContext {
  const within = (root: string, candidate: string) => {
    const base = path.resolve(root)
    const target = path.resolve(candidate)
    return target.startsWith(base + path.sep)
  }

  const resumePath = path.resolve(input.resumePath)
  const libraryRoot = path.resolve(path.join(input.userResumesRoot, input.userId))
  if (within(libraryRoot, resumePath)) {
    const relative = path.relative(libraryRoot, resumePath)
    const parts = relative.split(path.sep)
    if (!parts.length || parts.some(part => !part || part === "." || part === "..")) return { ok: false }
    if (input.files?.email && parts[0].toLowerCase() !== input.files.email.toLowerCase()) return { ok: false }
    const files = input.files ? {
      ...input.files,
      userDir: libraryRoot,
      abs: resumePath,
      rel: relative.split(path.sep).join("/"),
      depth: Math.max(0, parts.length - 1),
    } : undefined
    return { ok: true, location: "library", userResumeDir: libraryRoot, files }
  }

  const inboxRoot = path.resolve(input.inboxRoot)
  if (within(inboxRoot, resumePath)) {
    // A library selection must never silently turn into an inbox or another source.
    if (input.files) return { ok: false }
    return { ok: true, location: "inbox", userResumeDir: inboxRoot }
  }

  return { ok: false }
}
