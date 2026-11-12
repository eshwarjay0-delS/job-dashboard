// J1 authentication boundary: model output never establishes identity.
import path from "node:path"
import type { NextRequest } from "next/server"
import { AUTH_EGRESS_BLOCKED, AUTH_UNAVAILABLE, userFromAuthClient } from "./kompasAuthSession"
import { createClient, createClientFromRequest } from "./supabase/server"
import { disabledOwnerUser, isAuthDisabled } from "./authDisabled"

export async function authenticatedUserId(request?: NextRequest): Promise<string | null> {
  return (await authenticatedUser(request))?.id ?? null
}

export type AuthBlock = {
  kind: "egress" | "unavailable"
  status: 402 | 503
  code: "exceed_egress_quota" | "sign_in_unavailable"
  message: string
}

const authBlocks = new WeakMap<object, AuthBlock>()

export function takeAuthBlock(request: object | undefined): AuthBlock | null {
  if (!request) return null
  const block = authBlocks.get(request) || null
  authBlocks.delete(request)
  return block
}

/** The signed-in person, with their email only when the identity provider has confirmed it. */
export async function authenticatedUser(request?: NextRequest): Promise<{ id: string; email: string | null; synthetic?: true } | null> {
  // auth-boundaries tests strip imports; the typeof guards keep that suite
  // testing today's fail-closed behavior when the flag helper is absent.
  const authOff = typeof isAuthDisabled === "function" && isAuthDisabled()
  const owner = () => typeof disabledOwnerUser === "function"
    ? disabledOwnerUser()
    : { id: "disabled-owner", email: "eshwarjay0@gmail.com" }
  try {
    if (request) {
      const authorization = request.headers.get("authorization")
      // An explicitly supplied invalid credential must never fall back to cookies.
      if (authorization !== null && !/^Bearer\s+\S+$/i.test(authorization)) {
        return authOff ? { ...owner(), synthetic: true as const } : null
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !authorization) {
        const origin = request.headers.get("origin")
        if (request.headers.get("sec-fetch-site") === "cross-site" ||
            (origin !== null && origin !== request.nextUrl.origin)) {
          return authOff ? { ...owner(), synthetic: true as const } : null
        }
      }
    }
    const client = request ? await createClientFromRequest(request) : await createClient()
    const user = await userFromAuthClient(client)
    if (user?.id) return !user.unreachable && user.synthetic ? { id: user.id, email: user.email, synthetic: true as const } : { id: user.id, email: user.email }
    if (user?.unreachable && request && !authOff) {
      authBlocks.set(request, user.blocked === "egress"
        ? { kind: "egress", status: 402, code: "exceed_egress_quota", message: AUTH_EGRESS_BLOCKED }
        : { kind: "unavailable", status: 503, code: "sign_in_unavailable", message: AUTH_UNAVAILABLE })
    }
    return authOff ? { ...owner(), synthetic: true as const } : null
  } catch { return authOff ? { ...owner(), synthetic: true as const } : null }
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

// A PDF kept in the person's own Files (13 Oct 2026). It is its own check, so nothing that edits a resume (and asks
// `ownedResumePath` for a Word file) can ever be handed a PDF.
export function ownedPdfPath(base: string, userId: string, candidate: unknown): string | null {
  if (typeof candidate !== "string" || !candidate || candidate.includes("\0")) return null
  const root = path.resolve(base, userId)
  const resolved = path.resolve(candidate)
  return resolved.startsWith(root + path.sep) && resolved.toLowerCase().endsWith(".pdf") ? resolved : null
}
