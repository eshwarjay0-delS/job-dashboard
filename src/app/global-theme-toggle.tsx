"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "./theme-provider"

export default function GlobalThemeToggle() {
  const pathname = usePathname()
  const { mode, setMode } = useTheme()

  if (pathname.startsWith("/dashboard")) return null

  const dark = mode === "dark"
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to Paper theme" : "Switch to Night theme"}
      title={dark ? "Paper theme" : "Night theme"}
      onClick={() => setMode(dark ? "light" : "dark")}
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        zIndex: 1200,
        width: 44,
        height: 44,
        borderRadius: 14,
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        color: "var(--text)",
        display: "grid",
        placeItems: "center",
        fontSize: 22,
        lineHeight: 1,
        cursor: "pointer",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  )
}
