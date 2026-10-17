import { NextRequest } from "next/server"
import { adminOf } from "@/lib/adminAccess"
import { planImage, planText, productPlan } from "@/lib/plan-vision"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function GET(request: NextRequest) {
  if (!await adminOf(request)) return new Response("Admin access required", { status: 403, headers: { "Cache-Control": "no-store" } })
  const plan = productPlan(request.nextUrl.searchParams.get("area"))
  const format = request.nextUrl.searchParams.get("format")
  if (!plan || !["svg", "md"].includes(format ?? "")) return new Response("Choose a valid area and format", { status: 400 })
  const svg = format === "svg"
  return new Response(svg ? planImage(plan) : planText(plan), { headers: {
    "Content-Type": svg ? "image/svg+xml; charset=utf-8" : "text/markdown; charset=utf-8",
    "Content-Disposition": `${request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="mfit-${plan.id}-plan-vision.${format}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  } })
}
