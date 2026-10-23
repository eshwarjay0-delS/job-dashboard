import Link from "next/link"
import type { ReactNode } from "react"

/**
 * The plain shell for public pages that are not the landing page (Plans, Responsible use). Built only from the app's
 * colour tokens, so it reads the same in the paper and the night theme.
 */
export default function PublicPage({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede: string; children: ReactNode }) {
  const link = "text-[14.5px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MarketFit home">
            <span className="grid size-8 place-items-center rounded-[9px] bg-[var(--accent)] text-[13px] font-bold text-[var(--bg)]">MF</span>
            <span className="font-display text-[18px] font-bold text-[var(--text)]">MarketFit</span>
          </Link>
          <nav aria-label="Public pages" className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/plans" className={link}>Plans</Link>
            <Link href="/responsible-use" className={link}>Responsible use</Link>
            <Link href="/dashboard" className="text-[14.5px] font-semibold text-[var(--accent)]">Open app <span aria-hidden="true">→</span></Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-12">
        <p className="text-[14px] font-semibold text-[var(--accent)]">{eyebrow}</p>
        <h1 className="font-display mt-2 text-[34px] font-semibold leading-[1.15] text-[var(--text)] sm:text-[40px]">{title}</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-[1.65] text-[var(--text-muted)]">{lede}</p>
        {children}
      </main>
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-5 py-6 text-[13.5px] text-[var(--text-soft)]">
          <Link href="/plans" className="hover:text-[var(--text)]">Plans</Link>
          <Link href="/responsible-use" className="hover:text-[var(--text)]">Responsible use</Link>
          <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
