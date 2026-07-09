import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const paths = ["/", "/login", "/privacy", "/terms"]
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.6,
  }))
}
