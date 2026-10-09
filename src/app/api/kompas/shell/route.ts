import { mountKompasHtml } from "@/lib/kompas-shell"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const origin = (process.env.KOMPAS_API_ORIGIN || "https://perfact-ten.vercel.app").replace(/\/+$/, "")
  try {
    const response = await fetch(`${origin}/index.html`, { cache: "no-store", signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error("Kompas release unavailable")
    const html = mountKompasHtml(await response.text())
    const build = html.match(/window\.PERFACT_BUILD\s*=\s*"([a-zA-Z0-9._-]+)"/)?.[1] || "unknown"
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Kompas-Release": build } })
  } catch {
    return new Response('Kompas is temporarily unavailable. Reload to try again.', { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "10" } })
  }
}
