import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/kompas/capabilities — version/policy info for the Kompas page header.
// Ported from perfACT's /api/capabilities (the frontend shows "Kompas " + version).
// Public: the page calls this on load, before sign-in matters.

const NO_STORE = { "Cache-Control": "no-store" }
// The label is the exact commit this deployment was built from (Vercel sets VERCEL_GIT_COMMIT_SHA at build and run time),
// not a hand-edited date: the hand label read "2026-10-14.1" long after that release. "local" off Vercel.
const COMMIT = /^[0-9a-f]{7,40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || "") ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 7).toLowerCase() : ""

export async function GET() {
  return NextResponse.json({
    policy: "marketfit/kompas",
    version: COMMIT || "local",
    commit: COMMIT || null,
    immutable: true,
    cycle: "MarketFit's native Kompas: sessions on OpenRouter, answers blended from perfACT's answering intelligence.",
    rules: [
      { id: "openrouter-sessions", text: "Session answers generate on OpenRouter, not Groq." },
      { id: "tiered-answers", text: "Every question is classified (identity, STAR, design, drill-down, own-experience) and answered with that tier's rules." },
      { id: "dossier-grounded", text: "Answers ground in the speaker's real background, never invented specifics." },
      { id: "human-pauses", text: "Answers carry [beat]/[breath] markers for real timed pauses." },
    ],
  }, { headers: NO_STORE })
}
