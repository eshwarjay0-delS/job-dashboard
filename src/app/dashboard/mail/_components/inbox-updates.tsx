"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxUpdate, UpdatePreferences } from '@/lib/mail-update-policy'
import './inbox-updates.css'

type Snapshot = { preferences: UpdatePreferences; events: InboxUpdate[]; accounts: string[]; numbers: string[]; mobileReady: boolean; backgroundReady: boolean }
async function request(method = 'GET', body?: UpdatePreferences) {
  const response = await fetch('/api/gmail/updates', { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json()
  if (!response.ok) throw Error(result.error || 'Inbox updates are unavailable.')
  return result
}

export default function InboxUpdates() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [draft, setDraft] = useState<UpdatePreferences | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState<number | null>(null)
  const inFlight = useRef(false)
  const load = useCallback(async () => {
    const next: Snapshot = await request()
    setData(next)
    setDraft(next.preferences)
    return next
  }, [])
  useEffect(() => {
    let active = true
    request().then((next: Snapshot) => { if (active) { setData(next); setDraft(next.preferences) } }).catch(error => { if (active) setNotice(error.message) })
    return () => { active = false }
  }, [])
  const sync = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const result = await request('POST')
      setData(old => old ? { ...old, events: result.events } : old)
      setChecked(Date.now())
      const issues = (result.issues || []).map((issue: {account: string; reason: string}) => `${issue.account}: ${issue.reason}`)
      if (result.delivery?.reason) issues.push(result.delivery.reason)
      if (result.delivery?.blocked && !result.delivery?.reason) issues.push('A mobile alert needs review; it will not be sent again automatically.')
      setNotice(issues.join(' '))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Refresh failed.') }
    finally { inFlight.current = false; setBusy(false) }
  }, [])
  const enabled = data?.preferences.enabled === true
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void sync() }, 30000)
    return () => window.clearInterval(timer)
  }, [enabled, sync])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      await request('PATCH', draft)
      await load()
      setNotice('Update preferences saved.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save preferences.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <section className="inbox-updates" aria-label="Inbox updates">
    <div className="inbox-updates-heading"><div><h2>Inbox updates</h2><p>{enabled ? 'New messages from your selected inboxes. Refreshes every 30 seconds while this page is visible.' : 'Choose the inboxes you want to keep up with.'}</p></div>
      <button className="btn-outline" disabled={!enabled || busy} onClick={() => void sync()}>{busy ? 'Working…' : 'Refresh updates'}</button></div>
    {checked ? <small>Last checked {new Date(checked).toLocaleTimeString()}</small> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!data ? <button className="btn-outline" onClick={() => void load().catch(error => setNotice(error.message))}>Load update settings</button> : null}
    {data && draft ? <details><summary>Update settings</summary><form onSubmit={save}>
      <label><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} /> Keep my inbox updates</label>
      <fieldset><legend>Connected inboxes</legend>{data.accounts.length ? data.accounts.map(account => <label key={account}><input type="checkbox" checked={draft.accounts.includes(account)} onChange={e => setDraft({ ...draft, accounts: e.target.checked ? [...draft.accounts, account] : draft.accounts.filter(a => a !== account) })} /> {account}</label>) : <p>Connect Gmail in <a href="/dashboard/connections">Connections</a> first.</p>}</fieldset>
      <label><input type="checkbox" checked={draft.mobile} disabled={!draft.mobile && (!data.mobileReady || !data.numbers.length)} onChange={e => setDraft({ ...draft, mobile: e.target.checked })} /> Send new message alerts to my WhatsApp</label>
      {!data.mobileReady ? <small>WhatsApp alerts are waiting for server setup.</small> : !data.numbers.length ? <small>Verify your WhatsApp number in Connections to enable alerts.</small> : null}
      {draft.mobile ? <><label>Verified number <select value={draft.ending} onChange={e => setDraft({ ...draft, ending: e.target.value })}><option value="">Choose a number</option>{Array.from(new Set(data.numbers)).map(n => <option key={n} value={n}>Ending in {n}</option>)}</select></label>
        <label><input type="checkbox" checked={draft.onlyImportant} onChange={e => setDraft({ ...draft, onlyImportant: e.target.checked })} /> Only alert me about senders marked Important</label><p>Alerts include the receiving account, sender and subject. Existing inbox history will not trigger alerts.</p></> : null}
      <p>{data.backgroundReady ? 'Background refresh is configured. Delivery can be delayed.' : 'Updates refresh while this page is open. Background refresh is not configured yet.'}</p>
      <button className="btn-primary" disabled={busy || (draft.enabled && !draft.accounts.length) || (draft.enabled && draft.mobile && !draft.ending)}>Save preferences</button>
    </form></details> : null}
    {data ? <ul>{data.events.filter(e => data.preferences.accounts.includes(e.account)).slice(0,20).map(event => <li key={event.id}>
      <a href={`/dashboard/mail?open=${encodeURIComponent(event.thread)}&account=${encodeURIComponent(event.account)}`}><strong>{event.subject || '(No subject)'}</strong></a>
      <span>{event.from || 'Unknown sender'} · {event.account}</span><time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleString()}</time>
      {event.initial ? <small>Existing inbox message</small> : null}
    </li>)}</ul> : null}
    {enabled && !data?.events.length ? <p>No messages collected yet. Use Refresh updates to start.</p> : null}
  </section>
}
