"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"

export type Accent = "blue" | "teal" | "violet" | "rose" | "amber" | "emerald"
export type ColorMode = "light" | "dark" | "system"
export type Template = "clean" | "focus" | "apple" | "glass" | "pro" | "minimal"

interface ThemeCtx {
  accent: Accent
  mode: ColorMode
  template: Template
  setAccent: (a: Accent) => void
  setMode: (m: ColorMode) => void
  setTemplate: (t: Template) => void
}

const Ctx = createContext<ThemeCtx>({
  accent: "blue",
  mode: "light",
  template: "clean",
  setAccent: () => {},
  setMode: () => {},
  setTemplate: () => {},
})

export function useTheme() { return useContext(Ctx) }

// v3 — job-board palette (blue default); old saved accents are ignored
const STORAGE_KEY = "jd_theme_v3"

function persist(accent: Accent, mode: ColorMode, template: Template) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent, mode, template })) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent,   setAccentState]   = useState<Accent>("blue")
  const [mode,     setModeState]     = useState<ColorMode>("light")
  const [template, setTemplateState] = useState<Template>("clean")
  const [ready,    setReady]         = useState(false)

  // Hydrate from localStorage once (client-only)
  // "focus", "apple", and "minimal" hide the sidebar (display:none !important)
  // and have no UI to change them — guard against stale persisted values.
  const SIDEBAR_SAFE_TEMPLATES: Template[] = ["clean", "glass", "pro"]

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      if (s.accent)   setAccentState(s.accent as Accent)
      // The brand look is the LIGHT job-board palette (white cards + blue accent)
      // on every page. "system" was only ever a consolidation-era default — it
      // silently flipped the whole app to the dark palette for anyone whose OS
      // prefers dark, which read as a "black & white theme" nobody chose.
      // Migrate it to light once; picking Dark in Settings still works and sticks.
      if (s.mode === "system") {
        setModeState("light")
        persist(s.accent || "blue", "light", SIDEBAR_SAFE_TEMPLATES.includes(s.template) ? s.template : "clean")
      } else if (s.mode) {
        setModeState(s.mode as ColorMode)
      }
      if (s.template && SIDEBAR_SAFE_TEMPLATES.includes(s.template as Template)) {
        setTemplateState(s.template as Template)
      } else if (s.template) {
        // Stale sidebar-hiding template — reset to clean and update storage
        persist(s.accent || "blue", s.mode === "system" ? "light" : (s.mode || "light"), "clean")
      }
    } catch {}
    setReady(true)
  }, [])

  // Apply data-accent, data-theme, data-layout to <html>
  const apply = useCallback((acc: Accent, m: ColorMode, tpl: Template) => {
    const root = document.documentElement
    root.setAttribute("data-accent", acc)
    root.setAttribute("data-layout", tpl)

    // "Pro" is an inherently dark identity (Linear/Vercel) — force dark
    // regardless of the chosen mode so its palette reads correctly.
    const forceDark = tpl === "pro"
    const applyDark = (dark: boolean) =>
      root.setAttribute("data-theme", dark || forceDark ? "dark" : "light")

    if (m === "system" && !forceDark) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      applyDark(mq.matches)
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches)
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    } else {
      applyDark(m === "dark")
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    return apply(accent, mode, template) ?? undefined
  }, [accent, mode, template, ready, apply])

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a)
    setModeState(m => {
      setTemplateState(t => { persist(a, m, t); return t })
      return m
    })
  }, [])

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m)
    setAccentState(a => {
      setTemplateState(t => { persist(a, m, t); return t })
      return a
    })
  }, [])

  const setTemplate = useCallback((t: Template) => {
    setTemplateState(t)
    setAccentState(a => {
      setModeState(m => { persist(a, m, t); return m })
      return a
    })
  }, [])

  return (
    <Ctx.Provider value={{ accent, mode, template, setAccent, setMode, setTemplate }}>
      {children}
    </Ctx.Provider>
  )
}
