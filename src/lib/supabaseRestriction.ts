// Supabase project egress can be blocked and returns a restriction JSON
// (or the fetch itself fails). Pages and APIs must then show an empty
// state or a friendly message, never crash or bounce to sign-in.

export const SUPABASE_UNAVAILABLE_MESSAGE =
  "Saved data is temporarily unavailable. You can keep using the app."

export function isSupabaseRestricted(error: unknown): boolean {
  if (error == null) return false
  const obj = (typeof error === "object" ? error : { message: String(error) }) as Record<string, unknown>
  const bits = [
    obj.message, obj.msg, obj.error, obj.error_description, obj.error_code, obj.code, obj.name,
  ].map(v => (typeof v === "string" ? v : "")).join(" ")
  const lower = bits.toLowerCase()
  const status = Number(obj.status ?? obj.statusCode)
  if (obj.restricted === true) return true
  if (String(obj.code || "").toLowerCase() === "restricted") return true
  if (String(obj.name || "") === "AuthRetryableFetchError") return true
  if (/restrict|exceed_egress|egress quota|egress is restricted|project is restricted|not allowed to make this request/.test(lower)) {
    return true
  }
  if (/fetch failed|failed to fetch|networkerror|network request failed|timeout|econnrefused|enotfound|unavailable|egress/.test(lower)) {
    return true
  }
  if (status === 0 || status === 402 || status === 403 || (Number.isFinite(status) && status >= 500)) {
    return true
  }
  return false
}

export function supabaseSoftResult(data: unknown = null): {
  data: unknown
  error: null
  count: number | null
  status: number
  statusText: string
} {
  const empty = Array.isArray(data) ? [] : null
  return { data: empty, error: null, count: Array.isArray(empty) ? 0 : null, status: 200, statusText: "OK" }
}

type Thenable = { then?: unknown }

function wrapBuilder(builder: Thenable): Thenable {
  if (!builder || typeof builder !== "object") return builder
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        const run = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
          Promise.resolve(target).then(
            result => {
              const err = result && typeof result === "object" ? (result as { error?: unknown }).error : null
              if (isSupabaseRestricted(err)) resolve(supabaseSoftResult((result as { data?: unknown }).data))
              else resolve(result)
            },
            error => {
              if (isSupabaseRestricted(error)) resolve(supabaseSoftResult(null))
              else reject(error)
            },
          )
        }
        return run
      }
      const value = Reflect.get(target as object, prop, receiver)
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const out = value.apply(target, args)
          return out && typeof out === "object" ? wrapBuilder(out as Thenable) : out
        }
      }
      return value
    },
  })
}

export function softenSupabaseDataAccess<T extends { from?: unknown; rpc?: unknown }>(client: T): T {
  if (!client || typeof client !== "object") return client
  const originalFrom = typeof client.from === "function" ? (client.from as (...args: unknown[]) => unknown).bind(client) : null
  if (originalFrom) {
    client.from = ((...args: unknown[]) => wrapBuilder(originalFrom(...args) as Thenable)) as T["from"]
  }
  if (typeof client.rpc === "function") {
    const originalRpc = (client.rpc as (...args: unknown[]) => unknown).bind(client)
    client.rpc = (async (...args: unknown[]) => {
      try {
        const result = await originalRpc(...args)
        const err = result && typeof result === "object" ? (result as { error?: unknown }).error : null
        if (isSupabaseRestricted(err)) return supabaseSoftResult((result as { data?: unknown }).data)
        return result
      } catch (error) {
        if (isSupabaseRestricted(error)) return supabaseSoftResult(null)
        throw error
      }
    }) as T["rpc"]
  }
  return client
}
