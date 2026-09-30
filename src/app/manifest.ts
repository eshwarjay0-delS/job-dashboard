import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarketFit — Own Your Next Role",
    short_name: "MarketFit",
    description: "Tailor resumes in seconds, autofill any application in one click, and find visa-friendly jobs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}
