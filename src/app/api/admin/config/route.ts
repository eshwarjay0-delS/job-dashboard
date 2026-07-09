import { NextRequest, NextResponse } from "next/server"
import { readAdminConfig, writeAdminConfig, apiKeyStatus, verifyAdminToken, type AdminConfig } from "@/lib/adminConfig"

export const runtime = "nodejs"

function authed(req: NextRequest): boolean {
  return verifyAdminToken(req.cookies.get("mf_admin")?.value)
}

// GET → full admin config + API-key presence (booleans only, never values)
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ config: await readAdminConfig(), keys: apiKeyStatus() })
}

// POST → update post links and/or job-source toggles
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const patch: Partial<AdminConfig> = {}
  if (Array.isArray(body.postLinks)) patch.postLinks = body.postLinks
  if (Array.isArray(body.jobSources)) patch.jobSources = body.jobSources
  const config = await writeAdminConfig(patch)
  return NextResponse.json({ ok: true, config })
}
