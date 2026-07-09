import { NextRequest, NextResponse } from "next/server"
import { getH1BScore } from "@/lib/h1b"

export const runtime = "nodejs"

// GET /api/h1b?company=CompanyName
export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get("company") || ""
  if (!company) return NextResponse.json({ error: "company param required" }, { status: 400 })
  return NextResponse.json(getH1BScore(company))
}
