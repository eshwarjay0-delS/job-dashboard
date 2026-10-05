"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  ExperienceCapabilities,
  ExperiencePreference,
  ExperienceTier,
} from "./types"

type NetworkInformationLike = {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (name: "change", listener: () => void) => void
  removeEventListener?: (name: "change", listener: () => void) => void
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number
  connection?: NetworkInformationLike
}

type ExperienceContextValue = ExperienceCapabilities & {
  setPreference: (preference: ExperiencePreference) => void
}

const STORAGE_KEY = "marketfit_experience_preference_v1"

const DEFAULT_VALUE: ExperienceContextValue = {
  tier: "balanced",
  preference: "auto",
  reducedMotion: false,
  forcedColors: false,
  saveData: false,
  effectiveType: null,
  deviceMemoryGb: null,
  hardwareConcurrency: null,
  webgl2: false,
  pageVisible: true,
  canRenderRichMedia: false,
  setPreference: () => {},
}

const ExperienceContext = createContext<ExperienceContextValue>(DEFAULT_VALUE)

function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2", {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    }))
  } catch {
    return false
  }
}

function chooseTier(input: {
  preference: ExperiencePreference
  reducedMotion: boolean
  saveData: boolean
  effectiveType: string | null
  deviceMemoryGb: number | null
  hardwareConcurrency: number | null
  webgl2: boolean
}): ExperienceTier {
  if (input.preference === "reduced") return "static"

  const slowNetwork =
    input.saveData ||
    input.effectiveType === "slow-2g" ||
    input.effectiveType === "2g"

  if (input.reducedMotion || slowNetwork) return "static"

  const constrainedHardware =
    (input.deviceMemoryGb !== null && input.deviceMemoryGb <= 4) ||
    (input.hardwareConcurrency !== null && input.hardwareConcurrency <= 4)

  if (!input.webgl2 || constrainedHardware) return "balanced"
  if (input.preference === "rich") return "rich"

  const highEndHardware =
    (input.deviceMemoryGb === null || input.deviceMemoryGb >= 8) &&
    (input.hardwareConcurrency === null || input.hardwareConcurrency >= 8)

  return highEndHardware ? "rich" : "balanced"
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ExperiencePreference>("auto")
  const [reducedMotion, setReducedMotion] = useState(false)
  const [forcedColors, setForcedColors] = useState(false)
  const [saveData, setSaveData] = useState(false)
  const [effectiveType, setEffectiveType] = useState<string | null>(null)
  const [deviceMemoryGb, setDeviceMemoryGb] = useState<number | null>(null)
  const [hardwareConcurrency, setHardwareConcurrency] = useState<number | null>(null)
  const [webgl2, setWebgl2] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)

  const setPreference = useCallback((next: ExperiencePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "auto" || stored === "reduced" || stored === "rich") {
        setPreferenceState(stored)
      }
    } catch {}

    const nav = navigator as NavigatorWithHints
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const colors = window.matchMedia("(forced-colors: active)")
    const connection = nav.connection

    const refresh = () => {
      setReducedMotion(motion.matches)
      setForcedColors(colors.matches)
      setSaveData(Boolean(connection?.saveData))
      setEffectiveType(connection?.effectiveType || null)
      setDeviceMemoryGb(
        typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
      )
      setHardwareConcurrency(
        typeof nav.hardwareConcurrency === "number"
          ? nav.hardwareConcurrency
          : null,
      )
      setWebgl2(supportsWebGL2())
      setPageVisible(document.visibilityState !== "hidden")
    }

    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden")
    refresh()

    motion.addEventListener("change", refresh)
    colors.addEventListener("change", refresh)
    connection?.addEventListener?.("change", refresh)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      motion.removeEventListener("change", refresh)
      colors.removeEventListener("change", refresh)
      connection?.removeEventListener?.("change", refresh)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const tier = chooseTier({
    preference,
    reducedMotion,
    saveData,
    effectiveType,
    deviceMemoryGb,
    hardwareConcurrency,
    webgl2,
  })

  const value = useMemo<ExperienceContextValue>(() => ({
    tier,
    preference,
    reducedMotion,
    forcedColors,
    saveData,
    effectiveType,
    deviceMemoryGb,
    hardwareConcurrency,
    webgl2,
    pageVisible,
    canRenderRichMedia: webgl2 && tier !== "static",
    setPreference,
  }), [
    tier,
    preference,
    reducedMotion,
    forcedColors,
    saveData,
    effectiveType,
    deviceMemoryGb,
    hardwareConcurrency,
    webgl2,
    pageVisible,
    setPreference,
  ])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.experienceTier = tier
    root.dataset.motion = reducedMotion ? "reduced" : "full"
    root.dataset.pageVisibility = pageVisible ? "visible" : "hidden"
  }, [tier, reducedMotion, pageVisible])

  return (
    <ExperienceContext.Provider value={value}>
      {children}
    </ExperienceContext.Provider>
  )
}

export function useExperience() {
  return useContext(ExperienceContext)
}
