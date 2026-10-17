"use client"
import {useState} from 'react'
import Link from 'next/link'
import {REA_SESSIONS,filterReaSessions} from '@/lib/rea-register'
import './rea.css'
export default function ReaPage(){
 const [query,setQuery]=useState(''),[area,setArea]=useState('all'),[method,setMethod]=useState('all')
 const sessions=filterReaSessions(query,area,method)
 return <main className="rea-page"><header><Link href="/dashboard/admin/vision">← Plan &amp; Vision</Link><p className="rea-eyebrow">ADMIN / DEVELOPER RESEARCH</p><h1>REA · Research &amp; implementation</h1><p>Every reference, finding, experiment and implementation step. Evidence stays attached to the work.</p></header>
 <div className="rea-summary"><span><strong>{REA_SESSIONS.length}</strong> tracked sessions</span><span><strong>{REA_SESSIONS.filter(s=>s.state==='Blocked').length}</strong> blocked studies</span><span>Public reviews, source audits and REA tool runs are labeled separately.</span></div>
 <p className="rea-limit">This register covers the studies recovered so far. Historical backfill is still open. Updates ship with developer commits; it does not automatically read every external chat.</p>
 <div className="rea-filters"><label>Search evidence<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Poke, Parakeet, draft, parser…"/></label><label>Product<select value={area} onChange={e=>setArea(e.target.value)}><option value="all">All products</option>{['gmail','applications','resume','kompas','platform'].map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Research method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="all">All methods</option>{['Public reference review','Source and artifact analysis','REA tool attempt'].map(x=><option key={x}>{x}</option>)}</select></label></div>
 <p role="status">{sessions.length} sessions shown</p>
 <div className="rea-sessions">{sessions.map(s=><article key={s.id} id={s.id}><div className="rea-tags"><span>{s.area}</span><span>{s.method}</span><span>{s.state}</span></div><h2>{s.title}</h2><p>{s.request}</p><small>Updated {s.updated}</small>
 <details><summary>Open step-by-step evidence ({s.steps.length} steps)</summary><ol>{s.steps.map((step,i)=><li key={step.label}><div className="rea-step"><span>{String(i+1).padStart(2,'0')}</span><div><h3>{step.label} <small>{step.status}</small></h3><p>{step.finding}</p><p className="rea-evidence">Evidence: {step.evidence}</p></div></div></li>)}</ol>
 <h3>Sources</h3><ul>{s.sources.map(source=><li key={source.label}>{source.url?<a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>:<>{source.label}<br/><code>{source.path}</code></>}</li>)}</ul>
 <h3>Limits and unknowns</h3><p>{s.limits}</p><h3>Next action</h3><p>{s.next}</p>
 {s.commits.length?<><h3>Implementation commits</h3><ul>{s.commits.map(sha=><li key={sha}><a href={`https://github.com/eshwarjay0-delS/job-dashboard/commit/${sha}`} target="_blank" rel="noreferrer">{sha.slice(0,7)}</a></li>)}</ul></>:null}
 </details></article>)}</div>
 {!sessions.length?<p>No studies match those filters.</p>:null}
 </main>
}
