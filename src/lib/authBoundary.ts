// J1 authentication boundary: model output never establishes identity.
import path from "node:path"
import type { NextRequest } from "next/server"
import { createClient, createClientFromRequest } from "./supabase/server"

export async function authenticatedUserId(request?: NextRequest): Promise<string | null> {
  try {
    if (request) {
      const authorization = request.headers.get("authorization")
      // An explicitly supplied invalid credential must never fall back to cookies.
      if (authorization !== null && !/^Bearer\s+\S+$/i.test(authorization)) return null
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !authorization) {
        const origin = request.headers.get("origin")
        if (request.headers.get("sec-fetch-site") === "cross-site" ||
            (origin !== null && origin !== request.nextUrl.origin)) return null
      }
    }
    const client = request ? await createClientFromRequest(request) : await createClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user || data.user.is_anonymous) return null
    return data.user.id
  } catch { return null }
}

export function signInRequired() {
  return Response.json({ error: "Sign in to access your own resume files.", code: "AUTH_REQUIRED" }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  })
}

// A shared library has no verified owner; it is never an authorization source.
export function ownedResumePath(base: string, userId: string, candidate: unknown): string | null {
  if (typeof candidate !== "string" || !candidate || candidate.includes("\0")) return null
  const root = path.resolve(base, userId)
  const resolved = path.resolve(candidate)
  return resolved.startsWith(root + path.sep) && resolved.toLowerCase().endsWith(".docx") ? resolved : null
}
