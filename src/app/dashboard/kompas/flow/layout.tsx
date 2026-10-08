import type { Metadata } from "next"
import type { ReactNode } from "react"

// Kompas Flow as something a phone can keep on its Home Screen (owner, 2026-10-08: "make the same version available on
// ios friendly").
//
// An iPhone does not let any app keep a button over other apps or type into them: that is Apple's rule for every app, and
// no build of ours can change it. What an iPhone does allow is a page added to the Home Screen that opens like an app.
// These few lines are what make this page that: its own name and icon, opening without the browser's bars, starting here
// and not on the dashboard's front page. The scope is the whole site on purpose, so signing in (which passes through
// /login and back) stays inside the app and does not throw the person out to Safari.
export const metadata: Metadata = {
  title: "Kompas Flow",
  manifest: "/apps/kompas-flow.webmanifest",
  appleWebApp: { capable: true, title: "Kompas Flow", statusBarStyle: "default" },
  icons: { apple: [{ url: "/apps/kompas-flow-180.png", sizes: "180x180", type: "image/png" }] },
}

export default function FlowLayout({ children }: { children: ReactNode }) {
  return children
}
