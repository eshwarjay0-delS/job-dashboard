"use client"

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"
import { useExperience } from "./experience-provider"
import type { ExperienceTier } from "./types"

type ProgressiveVisualProps<P extends object> = {
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>
  componentProps: P
  fallback: ReactNode
  minimumTier?: Exclude<ExperienceTier, "static">
  rootMargin?: string
  className?: string
  "aria-label"?: string
}

function meetsTier(
  current: ExperienceTier,
  minimum: Exclude<ExperienceTier, "static">,
) {
  const rank: Record<ExperienceTier, number> = {
    static: 0,
    balanced: 1,
    rich: 2,
  }
  return rank[current] >= rank[minimum]
}

export function ProgressiveVisual<P extends object>({
  loader,
  componentProps,
  fallback,
  minimumTier = "balanced",
  rootMargin = "320px",
  className,
  "aria-label": ariaLabel,
}: ProgressiveVisualProps<P>) {
  const { tier, canRenderRichMedia, pageVisible } = useExperience()
  const hostRef = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [Loaded, setLoaded] = useState<ComponentType<P> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = hostRef.current
    if (!node) return

    if (!("IntersectionObserver" in window)) {
      setNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  useEffect(() => {
    if (
      Loaded ||
      failed ||
      !nearViewport ||
      !pageVisible ||
      !canRenderRichMedia ||
      !meetsTier(tier, minimumTier)
    ) return

    let cancelled = false

    const load = () => {
      loader()
        .then(module => {
          if (cancelled) return
          const component =
            typeof module === "function" ? module : module.default
          setLoaded(() => component)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }

    const idle = window.requestIdleCallback?.(load, { timeout: 1200 })
    if (idle === undefined) {
      const timer = window.setTimeout(load, 0)
      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }

    return () => {
      cancelled = true
      window.cancelIdleCallback?.(idle)
    }
  }, [
    Loaded,
    failed,
    nearViewport,
    pageVisible,
    canRenderRichMedia,
    tier,
    minimumTier,
    loader,
  ])

  const renderRich = Boolean(
    Loaded &&
    pageVisible &&
    canRenderRichMedia &&
    meetsTier(tier, minimumTier),
  )

  return (
    <div
      ref={hostRef}
      className={className}
      aria-label={ariaLabel}
      data-progressive-visual={renderRich ? "rich" : "fallback"}
    >
      {renderRich && Loaded ? <Loaded {...componentProps} /> : fallback}
    </div>
  )
}
