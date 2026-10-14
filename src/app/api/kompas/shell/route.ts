import { mountKompasHtml } from "@/lib/kompas-shell"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  // Self-hosted since 2026-10-14 (perfACT sunset): the frontend lives in
  // public/kompas/, no longer fetched from perfact-ten. Remote fetch remains
  // as a fallback only until the erase is confirmed.
  const localPath = join(process.cwd(), "public", "kompas", "index.html")
  try {
    const raw = await readFile(localPath, "utf8")
    const html = mountKompasHtml(raw)
    const build = html.match(/window\.PERFACT_BUILD\s*=\s*"([a-zA-Z0-9._-]+)"/)?.[1] || "self-hosted"
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Kompas-Release": build } })
  } catch {
    // Fallback: remote origin (pre-erase transition only).
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
}
