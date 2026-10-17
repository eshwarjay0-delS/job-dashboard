"use client"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import type { ProductPlan } from "@/lib/plan-vision"
import VisionMarkdown from "../vision/_components/md"
import VisionLive from "../vision/_components/live"
import styles from "./plan-vision.module.css"
const views = ["text", "image", "mind-map", "live"] as const
const labels = { text: "Developer notes", image: "Image overview", "mind-map": "Mind map", live: "Live status" }
export default function PlanVision({ plans, revision, initialArea = "gmail", sourceDocs = [] }: { plans: ProductPlan[]; revision: string; initialArea?: string; sourceDocs?: { product: string; markdown: string }[] }) {
  const params = useSearchParams(), router = useRouter()
  const plan = plans.find(p => p.id === initialArea) ?? plans[0]
  const view = views.find(v => v === params.get("view")) ?? "text"
  function select(area: string, nextView: string) { router.replace(`/dashboard/admin/vision/${area === "applications" ? "apply" : area}?view=${nextView}`, { scroll: false }) }
  const exportUrl = (format: string, download = false) => `/api/admin/plan-vision?area=${plan.id}&format=${format}${download ? "&download=1" : ""}`
  return <div className={styles.root}>
    <header className={styles.header}><div><p className={styles.eyebrow}>ADMIN / DEVELOPER WORKSPACE</p><h1>Plan and Vision</h1><p>One shared reference for what MFit is building and how we verify it.</p></div><Link href="/dashboard/admin/vision">All product plans</Link></header>
    <nav aria-label="Product plans" className={styles.areas}>{plans.map(p => <button key={p.id} type="button" aria-pressed={p.id === plan.id} onClick={() => select(p.id, view)}>{p.title}</button>)}</nav>
    <section className={styles.intro} aria-labelledby="plan-title"><div><p className={styles.eyebrow}>VERSIONED PLAN · {revision}</p><h2 id="plan-title">{plan.title}</h2><p>{plan.purpose}</p></div><Link href={plan.route}>Open {plan.title} →</Link></section>
    <div className={styles.toolbar}><div className={styles.views} role="group" aria-label="Plan presentation">{views.map(v => <button key={v} aria-pressed={v === view} onClick={() => select(plan.id, v)}>{labels[v]}</button>)}</div><div className={styles.downloads}><a href={exportUrl("md", true)}>Download notes</a><a href={exportUrl("svg", true)}>Download image</a></div></div>
    <p className={styles.status}><strong>Implementation baseline.</strong> {plan.baseline}</p>
    {view === "text" && <div className={styles.notes}>{plan.branches.map((b,i) => <section key={b.title}><span className={styles.number}>{String(i+1).padStart(2,"0")}</span><div><h3>{b.title}</h3><ul>{b.notes.map(n => <li key={n}>{n}</li>)}</ul></div></section>)}</div>}
    {view === "image" && <figure className={styles.figure}>
      {/* Authenticated SVG is a precise diagram, not a remotely optimized image. */}
      <img src={exportUrl("svg")} width={1200} height={1180} alt={`${plan.title} plan: ${plan.branches.map(b => b.title).join(", ")}. Full details are in Developer notes and Mind map.`} />
      <figcaption>Four workstreams and their build sequence. Download the SVG to zoom or share with your developers.</figcaption>
    </figure>}
    {view === "mind-map" && <section className={styles.map} aria-label={`${plan.title} mind map`}><div className={styles.mapRoot}>{plan.title}<small>{plan.purpose}</small></div><div className={styles.branches}>{plan.branches.map(b => <details key={b.title} open><summary>{b.title}</summary><ul>{b.notes.map(n => <li key={n}>{n}</li>)}</ul></details>)}</div></section>}
    {view === "live" && <section aria-label={`${plan.title} live status`} style={{ marginTop: 4 }}><VisionLive product={plan.id} /></section>}
    <div className={styles.delivery}><section><h3>Build sequence</h3><p>Ordered work, not completion status. Owners and dates are assigned during handoff.</p><ol>{plan.phases.map(p => <li key={p}>{p}</li>)}</ol></section><section><h3>Acceptance checks</h3><p>Evidence required before a phase is called shipped.</p><ul>{plan.acceptance.map(c => <li key={c}>{c}</li>)}</ul></section></div>
    {sourceDocs.find(d => d.product === (plan.id === "applications" ? "apply" : plan.id)) && <details className={styles.handoff}><summary>Full source vision document</summary><VisionMarkdown markdown={sourceDocs.find(d => d.product === (plan.id === "applications" ? "apply" : plan.id))!.markdown} /></details>}
    <details className={styles.handoff}><summary>Developer handoff and source files</summary><p>Update <code>src/lib/plan-vision.ts</code> in a reviewed commit. The text, image, and mind-map views use that single model, so notes remain shared across developers and devices. The <strong>Live status</strong> view reads <code>docs/wishes.md</code> and the git log fresh on every load — keep the wishes ledger updated as work moves: proposed → approved → building → done.</p><p>Every handoff should record changed behavior, acceptance evidence, remaining gaps and the release commit. Keep the source documents below aligned with any accepted changes.</p><ul>{plan.sources.map(s => <li key={s}><code>{s}</code></li>)}</ul><p>Shared dependencies: verified account identity → source evidence → generation or action → durable result → audit and recovery.</p></details>
  </div>
}
