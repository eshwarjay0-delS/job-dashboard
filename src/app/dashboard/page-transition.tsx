"use client"

import { usePathname } from "next/navigation"

// PDF2 §2 — Page Transitions (CSS-only, no animation library).
// The `key={pathname}` remounts the wrapper on every route change, which
// re-fires the `page-in` CSS animation defined in globals.css. The
// `data-route` attribute lets globals.css pick a route-specific variant
// (e.g. slideRight for the resume tool, fade for the calm dashboard home).
function routeKind(pathname: string): string {
  if (pathname === "/dashboard") return "dashboard"
  if (pathname.includes("/resume")) return "resume"
  return "default"
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-transition" data-route={routeKind(pathname)}>
      {children}
    </div>
  )
}
