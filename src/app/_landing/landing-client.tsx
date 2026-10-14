"use client"

// The few moving parts of the landing page: the bar at the top, the theme switch, joining the list for a plan, and a
// gentle reveal as sections come into view. Everything else on the page is plain server-rendered markup.

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Check, Moon, Sun, Menu, X } from "lucide-react"
import { useTheme } from "../theme-provider"

export function LandingNav() {
  const { mode, setMode } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  const dark = mode === "dark"
  const links = [["#product", "Product"], ["#how", "How it works"], ["#pricing", "Pricing"], ["#faq", "Questions"]]
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-200 ${scrolled ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] shadow-[0_1px_0_rgba(25,20,10,.03)] backdrop-blur-md" : "border-b border-transparent"}`}>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="MarketFit home">
          <span className="grid size-8 place-items-center rounded-[9px] bg-[var(--accent)] font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.18)]">MF</span>
          <span className="font-[family-name:var(--font-display)] text-[19px] font-bold tracking-[-0.01em] text-[var(--text)]">MarketFit</span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-[14.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode(dark ? "light" : "dark")} aria-label={dark ? "Switch to the paper theme" : "Switch to the night theme"}
            className="grid size-9 cursor-pointer place-items-center rounded-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
            {dark ? <Sun size={18} className="text-[var(--text-muted)]" /> : <Moon size={18} className="text-[var(--text-muted)]" />}
          </button>
          <Link href="/login" className="hidden h-9 items-center rounded-[10px] px-3.5 text-[14.5px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] sm:inline-flex">Sign in</Link>
          <Link href="/signup" className="hidden h-9 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-4 text-[14.5px] font-semibold text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.14)] transition-[background,box-shadow] hover:bg-[var(--accent-h)] hover:shadow-[0_6px_16px_-6px_rgba(25,20,10,.3)] sm:inline-flex">
            Get started <ArrowRight size={16} className="text-[var(--bg)]" />
          </Link>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-9 cursor-pointer place-items-center rounded-[10px] text-[var(--text)] hover:bg-[var(--surface-2)] md:hidden">
            {open ? <X size={20} className="text-[var(--text)]" /> : <Menu size={20} className="text-[var(--text)]" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)] px-5 pb-5 pt-2 md:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-[16px] font-medium text-[var(--text)]">{label}</a>
          ))}
          <div className="mt-3 flex gap-2">
            <Link href="/login" className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--border-strong)] font-semibold text-[var(--text)]">Sign in</Link>
            <Link href="/signup" className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[var(--accent)] font-semibold text-[var(--bg)]">Get started</Link>
          </div>
        </div>
      )}
    </header>
  )
}

/** Fades a section up the first time it comes into view. Nothing moves for someone who asked for less motion. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    // With reduced motion the global rule makes the change instant; with no observer at all, show it on the next frame.
    if (!("IntersectionObserver" in window)) { const frame = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(frame) }
    const seen = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); seen.disconnect() }
    }, { rootMargin: "0px 0px -8% 0px" })
    seen.observe(node)
    return () => seen.disconnect()
  }, [])
  return (
    <div ref={ref} className={`transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}>
      {children}
    </div>
  )
}

/** Join the list for a plan that cannot be paid for yet. One field, one button, and a plain answer. */
export function JoinList({ plan, label, highlight = false }: { plan: string; label: string; highlight?: boolean }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [why, setWhy] = useState("")
  const base = "flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-semibold transition-[background,box-shadow,border-color]"
  const style = highlight
    ? `${base} bg-[var(--accent)] text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.14)] hover:bg-[var(--accent-h)]`
    : `${base} border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--text-soft)]`
  if (state === "done") {
    return <p role="status" className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--success-soft)] text-[14px] font-semibold text-[var(--success)]"><Check size={16} className="text-[var(--success)]" /> You are on the list</p>
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={style}>{label}</button>
  async function send(event: React.FormEvent) {
    event.preventDefault()
    setState("sending"); setWhy("")
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, plan }) })
      if (response.ok) { setState("done"); return }
      const body = await response.json().catch(() => ({}))
      setWhy(String(body.error || "That did not go through. Try again in a moment.")); setState("error")
    } catch { setWhy("That did not go through. Check your connection and try again."); setState("error") }
  }
  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`list-${plan}`}>Your email</label>
      <input id={`list-${plan}`} type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
        className="h-11 w-full rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 text-[15px] text-[var(--text)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]" />
      <button type="submit" disabled={state === "sending"} className={style}>{state === "sending" ? "Adding you…" : "Tell me when it opens"}</button>
      {why && <p role="alert" className="text-[13px] text-[var(--danger)]">{why}</p>}
    </form>
  )
}
