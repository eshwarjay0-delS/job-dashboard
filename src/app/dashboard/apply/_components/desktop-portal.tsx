'use client'
import { useState } from 'react'

export function DesktopPortal({ url, beforeOpen }: { url: string; beforeOpen: (proceed: () => void) => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  async function open() {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const response = await fetch('/api/apply/browser-context', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !/^[a-f0-9]{64}$/.test(data.account || '')) throw Error('Sign in to MarketFit before opening the desktop browser.')
      const target = new URL(url)
      if (target.protocol !== 'https:' || target.username || target.password) throw Error('This portal needs a valid HTTPS address.')
      const launch = new URL('marketfit-kompas://browse')
      launch.searchParams.set('url', target.href)
      launch.searchParams.set('account', data.account)
      window.location.assign(launch.href)
      setNote('Open the updated Kompas desktop when your browser asks. Sign in there with the same MarketFit account. If it is not installed, use Apply on portal.')
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not open the desktop browser.')
    } finally { setBusy(false) }
  }
  return <><button className="btn-ghost" disabled={busy} onClick={() => beforeOpen(() => void open())}>{busy ? 'Opening…' : 'Open in desktop'}</button>{note && <p role="status">{note}</p>}</>
}
