"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"

export type Accent = "blue" | "teal" | "violet" | "rose" | "amber" | "emerald"
export type ColorMode = "light" | "dark" | "system"
export type Template = "clean" | "focus" | "apple" | "glass" | "pro" | "minimal"
export type Palette = "paper-bold" | "heritage" | "nocturne" | "alpine"

interface ThemeCtx {
  accent: Accent
  mode: ColorMode
  template: Template
  palette: Palette
  setAccent: (a: Accent) => void
  setMode: (m: ColorMode) => void
  setTemplate: (t: Template) => void
  setPalette: (p: Palette) => void
}

const Ctx = createContext<ThemeCtx>({
  accent: "blue",
  mode: "light",
  template: "clean",
  palette: "paper-bold",
  setAccent: () => {},
  setMode: () => {},
  setTemplate: () => {},
  setPalette: () => {},
})

export function useTheme() { return useContext(Ctx) }

const STORAGE_KEY = "jd_theme_v4"
const LEGACY_STORAGE_KEY = "jd_theme_v3"

function persist(accent: Accent, mode: ColorMode, template: Template, palette: Palette) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent, mode, template, palette })) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent,   setAccentState]   = useState<Accent>("blue")
  const [mode,     setModeState]     = useState<ColorMode>("light")
  const [template, setTemplateState] = useState<Template>("clean")
  const [palette,  setPaletteState]  = useState<Palette>("paper-bold")
  const [ready,    setReady]         = useState(false)

  const SIDEBAR_SAFE_TEMPLATES: Template[] = ["clean", "glass", "pro"]
  const PALETTES: Palette[] = ["paper-bold", "heritage", "nocturne", "alpine"]

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}"
      const s = JSON.parse(raw)
      const nextAccent: Accent = s.accent || "blue"
      const nextMode: ColorMode = s.mode === "system" ? "light" : (s.mode || "light")
      const nextTemplate: Template = SIDEBAR_SAFE_TEMPLATES.includes(s.template) ? s.template : "clean"
      const nextPalette: Palette = PALETTES.includes(s.palette) ? s.palette : "paper-bold"

      setAccentState(nextAccent)
      setModeState(nextMode)
      setTemplateState(nextTemplate)
      setPaletteState(nextPalette)
      persist(nextAccent, nextMode, nextTemplate, nextPalette)
    } catch {}
    setReady(true)
  }, [])

  const apply = useCallback((acc: Accent, m: ColorMode, tpl: Template, pal: Palette) => {
    const root = document.documentElement
    root.setAttribute("data-accent", acc)
    root.setAttribute("data-layout", tpl)
    root.setAttribute("data-palette", pal)

    const forceDark = tpl === "pro"
    const applyDark = (dark: boolean) =>
      root.setAttribute("data-theme", dark || forceDark ? "dark" : "light")

    if (m === "system" && !forceDark) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      applyDark(mq.matches)
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches)
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }

    applyDark(m === "dark")
  }, [])

  useEffect(() => {
    if (!ready) return
    return apply(accent, mode, template, palette) ?? undefined
  }, [accent, mode, template, palette, ready, apply])

  const saveWith = useCallback((next: Partial<{ accent: Accent; mode: ColorMode; template: Template; palette: Palette }>) => {
    setAccentState(a => {
      const na = next.accent ?? a
      setModeState(m => {
        const nm = next.mode ?? m
        setTemplateState(t => {
          const nt = next.template ?? t
          setPaletteState(p => {
            const np = next.palette ?? p
            persist(na, nm, nt, np)
            return np
          })
          return nt
        })
        return nm
      })
      return na
    })
  }, [])

  const setAccent = useCallback((a: Accent) => saveWith({ accent: a }), [saveWith])
  const setMode = useCallback((m: ColorMode) => saveWith({ mode: m }), [saveWith])
  const setTemplate = useCallback((t: Template) => saveWith({ template: t }), [saveWith])
  const setPalette = useCallback((p: Palette) => saveWith({ palette: p }), [saveWith])

  return (
    <Ctx.Provider value={{ accent, mode, template, palette, setAccent, setMode, setTemplate, setPalette }}>
      {children}
    </Ctx.Provider>
  )
}
