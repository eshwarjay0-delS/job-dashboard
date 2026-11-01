import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }

// The desktop shell's update manifest: the version it should be on, and where
// to download it. Both come from the same publish step that serves the
// downloads page — KOMPAS_DESKTOP_URL is already that page's public download
// URL, and KOMPAS_DESKTOP_VERSION is the version string of that same asset.
// Until both are set and well-formed, the shell is told nothing: it must
// never prompt for an update it cannot identify or fetch. No auth here —
// a version number and a public download link are not user data.
export async function GET() {
  const version = (process.env.KOMPAS_DESKTOP_VERSION || "").trim()
  const downloadUrl = (process.env.KOMPAS_DESKTOP_URL || "").trim()
  if (!/^\d+(\.\d+)*$/.test(version) || !/^https:\/\//.test(downloadUrl)) {
    return NextResponse.json({ version: null, downloadUrl: null }, { headers: NO_STORE })
  }
  return NextResponse.json({ version, downloadUrl }, { headers: NO_STORE })
}
