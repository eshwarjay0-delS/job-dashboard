import { NextRequest } from "next/server"

export const runtime = "nodejs"

const ALLOWED_NAMES = new Set([
  "TTFB",
  "FCP",
  "LCP",
  "FID",
  "CLS",
  "INP",
])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (
    !body ||
    typeof body.name !== "string" ||
    !ALLOWED_NAMES.has(body.name) ||
    typeof body.value !== "number" ||
    !Number.isFinite(body.value)
  ) {
    return new Response(null, { status: 204 })
  }

  const event = {
    type: "web-vital",
    name: body.name,
    value: body.value,
    rating: typeof body.rating === "string" ? body.rating.slice(0, 20) : null,
    id: typeof body.id === "string" ? body.id.slice(0, 120) : null,
    route:
      typeof body.route === "string" && body.route.startsWith("/")
        ? body.route.slice(0, 240)
        : null,
    experienceTier:
      body.experienceTier === "static" ||
      body.experienceTier === "balanced" ||
      body.experienceTier === "rich"
        ? body.experienceTier
        : null,
    reducedMotion: Boolean(body.reducedMotion),
    saveData: Boolean(body.saveData),
    at: typeof body.at === "number" ? body.at : Date.now(),
  }

  // Structured console output is intentionally the first observability sink.
  // Vercel captures this without adding a client bundle. A Sentry/OTel adapter can
  // consume the same event later without changing the UI runtime.
  console.info(JSON.stringify(event))

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  })
}
