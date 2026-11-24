import { lstat, realpath } from "node:fs/promises"
import { resolve, relative, isAbsolute, join, sep } from "node:path"

export type ExplicitLibraryFallbackFiles = {
  userDir?: string
  email?: string
  rel?: string
  abs?: string
  explicitlySelected?: boolean
}
export type ExplicitLibraryFallbackSession = { resumePath?: string }
export type ExplicitLibraryFallbackStorageMode = "r2" | "filesystem" | "unavailable"

function withinRoot(relativePath: string): boolean {
  return !!relativePath && relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)
}

/**
 * Validate an unchanged-original fallback before the durable job is sent.
 * R2 keys have no symlink semantics; local filesystem paths must resolve to
 * the same account root and contain no symlink component.
 */
export async function explicitLibraryFallbackPathMatches(
  files: ExplicitLibraryFallbackFiles | undefined,
  session: ExplicitLibraryFallbackSession,
  expectedRootRaw: string | undefined,
  mode: ExplicitLibraryFallbackStorageMode,
): Promise<boolean> {
  if (!files?.explicitlySelected || !files.userDir || !files.email?.trim() ||
      !files.rel || !files.abs || !session.resumePath || !expectedRootRaw || mode === "unavailable") return false
  const expectedRoot = resolve(expectedRootRaw)
  const userRoot = resolve(files.userDir)
  const selectedPath = resolve(files.abs)
  const sessionPath = resolve(session.resumePath)
  const email = files.email.trim().toLowerCase()
  if (userRoot !== expectedRoot || selectedPath !== sessionPath || isAbsolute(files.rel)) return false
  const parts = files.rel.split("/")
  if (parts.length < 2 || parts.some(part => !part || part === "." || part === ".." || part.includes("\\"))) return false
  const relativePath = relative(userRoot, selectedPath)
  if (!withinRoot(relativePath) || relativePath.split(sep)[0].toLowerCase() !== email) return false
  if (resolve(userRoot, ...parts) !== selectedPath) return false

  if (mode === "filesystem") {
    try {
      const [rootReal, userReal, selectedReal] = await Promise.all([
        realpath(expectedRoot), realpath(userRoot), realpath(selectedPath),
      ])
      if (rootReal !== userReal) return false
      const relativeReal = relative(rootReal, selectedReal)
      if (!withinRoot(relativeReal) || relativeReal.split(sep)[0].toLowerCase() !== email ||
          resolve(rootReal, ...parts) !== selectedReal) return false
      if ((await lstat(userRoot)).isSymbolicLink()) return false
      let cursor = userRoot
      for (const part of relativePath.split(sep)) {
        cursor = join(cursor, part)
        if ((await lstat(cursor)).isSymbolicLink()) return false
      }
    } catch {
      // A missing, unreadable, or changed local path cannot authorize an original-file send.
      return false
    }
  }
  return true
}
