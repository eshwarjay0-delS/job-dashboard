export type ExperiencePreference = "auto" | "reduced" | "rich"
export type ExperienceTier = "static" | "balanced" | "rich"

export type ExperienceCapabilities = {
  tier: ExperienceTier
  preference: ExperiencePreference
  reducedMotion: boolean
  forcedColors: boolean
  saveData: boolean
  effectiveType: string | null
  deviceMemoryGb: number | null
  hardwareConcurrency: number | null
  webgl2: boolean
  pageVisible: boolean
  canRenderRichMedia: boolean
}

export type ScenePolicy = {
  maxDevicePixelRatio: number
  allowZoom: boolean
  allowPan: boolean
  allowRotate: boolean
  pauseWhenHidden: boolean
  lazyLoadMargin: string
}

export const DEFAULT_SCENE_POLICY: ScenePolicy = {
  maxDevicePixelRatio: 1.75,
  allowZoom: false,
  allowPan: false,
  allowRotate: true,
  pauseWhenHidden: true,
  lazyLoadMargin: "320px",
}
