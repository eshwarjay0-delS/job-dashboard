import { DEFAULT_SCENE_POLICY } from "./types"
import type { ExperienceTier, ScenePolicy } from "./types"

export const EXPERIENCE_BUDGETS = {
  targetFramesPerSecond: 60,
  maxInitialRichMediaBytes: 1_500_000,
  maxDeferredRichMediaBytes: 4_000_000,
  maxCompressedTextureEdgeMobile: 2048,
  maxCompressedTextureEdgeDesktop: 4096,
  maxLongTaskMs: 50,
} as const

export function scenePolicyForTier(tier: ExperienceTier): ScenePolicy {
  if (tier === "static") {
    return {
      ...DEFAULT_SCENE_POLICY,
      maxDevicePixelRatio: 1,
      allowRotate: false,
    }
  }

  if (tier === "balanced") {
    return {
      ...DEFAULT_SCENE_POLICY,
      maxDevicePixelRatio: 1.25,
    }
  }

  return DEFAULT_SCENE_POLICY
}

export function clampDevicePixelRatio(
  devicePixelRatio: number,
  tier: ExperienceTier,
) {
  return Math.min(
    Math.max(devicePixelRatio || 1, 1),
    scenePolicyForTier(tier).maxDevicePixelRatio,
  )
}
