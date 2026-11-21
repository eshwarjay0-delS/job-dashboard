import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { speakableBridge } from "@/lib/kompasAnswerService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 20

/** One speakable line from the cleaned turns. Empty when no model can answer. */
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ lines: [] }, { headers: { "Cache-Control": "no-store" } })
  let body: { turns?: Array<{ who?: string; text?: string }>; question?: string } = {}
  try { body = await request.json() } catch { body = {} }
  const lines = await speakableBridge(body, request.signal)
  return NextResponse.json({ lines }, { headers: { "Cache-Control": "no-store" } })
}
