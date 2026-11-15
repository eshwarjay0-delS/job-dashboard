import { createHash } from "node:crypto"

const etagOf = value => createHash("sha256")
  .update(Buffer.isBuffer(value) ? value : Buffer.from(String(value)))
  .digest("hex")

/** In-memory Blob test adapter with the same compare-and-swap contract as R2. */
export function etagBlobMethods(entries, options = {}) {
  return {
    getWithEtag: async key => {
      const value = entries.get(key)
      if (value == null) return null
      const data = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value))
      return { data, etag: etagOf(data) }
    },
    putIfMatch: async (key, expectedEtag, value) => {
      await options.beforePutIfMatch?.(key, expectedEtag, value)
      const current = entries.get(key)
      if (current == null || etagOf(current) !== expectedEtag) return false
      entries.set(key, value)
      return true
    },
  }
}
