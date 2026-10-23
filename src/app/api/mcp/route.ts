// MFit MCP endpoint (Streamable HTTP): POST /api/mcp. Design and status: docs/mcp-surface.md.
//
// Mistake this prevents: shipping an unreviewed way into people's accounts. It is OFF unless MCP_ENABLED=1, and
// answers 404 to every method until then. It needs a security review before the owner turns it on.
//
// This file only wires real dependencies into the tested core (src/lib/mcp/server.ts): Supabase Bearer
// verification (the same check other routes use), and the existing routes the tools wrap, called in-process
// with the caller's own token so each still enforces its own sign-in, ownership and limits.
import { NextRequest } from "next/server"
import { handleMcp } from "@/lib/mcp/server"
import { createRouteBackend } from "@/lib/mcp/backend"
import { authenticatedUser } from "@/lib/authBoundary"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { checkRateLimit } from "@/lib/rateLimit"
import { VENDOR_PORTALS } from "@/lib/vendorPortals"
import { automationPath, detectAts } from "@/lib/ats-fingerprints"
import { GET as jobsGET } from "@/app/api/jobs/route"
import { GET as resumesGET } from "@/app/api/resumes/route"
import { POST as matchPOST } from "@/app/api/apply/match/route"
import { POST as tailorPOST } from "@/app/api/tailor/route"
import { GET as activityGET } from "@/app/api/apply/activity/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// tailor_resume runs the same synchronous tailor as the website, which is given 300 s.
export const maxDuration = 300

async function handle(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin
  return handleMcp(request, {
    env: process.env,
    verify: r => authenticatedUser(r as NextRequest),
    rateLimit: checkRateLimit,
    backend: createRouteBackend({
      resumesBase: USER_RESUMES_DIR,
      makeRequest: (pathAndQuery, init) => new NextRequest(new URL(pathAndQuery, origin), init),
      routes: {
        jobs: r => jobsGET(r as NextRequest),
        resumes: r => resumesGET(r as NextRequest),
        match: r => matchPOST(r as NextRequest),
        tailor: r => tailorPOST(r as NextRequest),
        activity: r => activityGET(r as NextRequest),
      },
      portals: VENDOR_PORTALS,
      detectAts,
      automationPath,
    }),
  })
}

// Every method goes through the same gate, so a switched-off endpoint answers 404 to all of them (Next would
// otherwise answer OPTIONS and unknown methods itself and reveal that the route exists).
export const POST = handle
export const GET = handle
export const DELETE = handle
export const PUT = handle
export const PATCH = handle
export const HEAD = handle
export const OPTIONS = handle
