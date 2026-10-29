/** Listing is a directory-prefix operation, not an object-key write.
 * Accept one optional trailing slash for legacy callers, while preserving
 * strict key validation for put/get/delete and rejecting traversal/double slashes.
 */
export function storageListPrefix(prefix: string): string {
  const normalized = prefix.endsWith("/") && prefix.length > 1 ? prefix.slice(0, -1) : prefix
  return storageSegments(normalized).join("/")
}

/** Reject ambiguous object keys instead of silently mapping them to another file. */
export function storageSegments(key: string): string[] {
  if (key === "") return []
  if (/^[\\/]|^[a-z]:/i.test(key) || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new Error("Invalid storage key")
  }
  const parts = key.replace(/\\/g, "/").split("/")
  if (parts.some(part => !part || part === "." || part === "..")) {
    throw new Error("Invalid storage key")
  }
  return parts
}

export function storageMode(env: Record<string, string | undefined>): "r2" | "filesystem" | "unavailable" {
  const names = ["R2_BUCKET", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
  const present = names.filter(name => env[name]?.trim())
  if (present.length === names.length) return "r2"
  // A partial configuration must never silently switch data stores.
  if (present.length || env.VERCEL) return "unavailable"
  return "filesystem"
}
