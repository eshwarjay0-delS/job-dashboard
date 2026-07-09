import { NextResponse } from "next/server"
import { readAdminConfig } from "@/lib/adminConfig"

export const runtime = "nodejs"

// Public read: the admin-managed, enabled recruiter/LinkedIn post links that the
// Contract board's "Posts" tab renders. Admin adds/toggles these in the panel;
// this endpoint exposes only the enabled ones (no config secrets).
export async function GET() {
  const cfg = await readAdminConfig()
  return NextResponse.json({ posts: cfg.postLinks.filter(p => p.enabled) })
}
