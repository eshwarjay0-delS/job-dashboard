import Link from "next/link"
import { FileText, Mail, Mic, ArrowRight, MessageCircle, Puzzle } from "lucide-react"

const features = [
  { title: "Fix my resume", text: "Choose your resume. Paste a job post. Review what changed.", href: "/dashboard/resume", icon: FileText, note: "Your experience. Your original file kept safe.", links: [{ href: "/dashboard/documents", label: "My files" }, { href: "/dashboard/resume/builder", label: "Build a resume" }] },
  { title: "Check job emails", text: "Connect Gmail and find the messages about your job search.", href: "/dashboard/email", icon: Mail, note: "Start with your connected inbox.", links: [{ href: "/dashboard/connections", label: "Connect Gmail" }, { href: "/dashboard/tracker", label: "My applications" }] },
]

export default function DashboardPage() {
  return <div className="mf-home">
    <header className="mf-home-heading">
      <p className="mf-eyebrow">YOUR JOB SEARCH, ONE PLACE</p>
      <h1>What would you like to do?</h1>
      <p>Pick one thing. We’ll help you take the next step.</p>
    </header>
    <section className="mf-feature-grid" aria-label="Your two main tools">
      {features.map(({ title, text, href, icon: Icon, note, links }, i) => <article className="mf-feature" key={href}>
        <div className={`mf-feature-icon mf-tone-${i}`}><Icon size={25} aria-hidden="true" /></div>
        <h2>{title}</h2><p>{text}</p>
        <a href={href} className="mf-primary-link">{title}<ArrowRight size={18} aria-hidden="true" /></a>
        <p className="mf-feature-note">{note}</p>
        <div className="mf-related">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
      </article>)}
    </section>
    <section className="mf-access"><div><h2>Preparing for an interview?</h2><p>Speak, type, and practice with Kompas.</p></div><a className="mf-primary-link" href="/dashboard/kompas"><Mic size={19} aria-hidden="true" />Practice an interview<ArrowRight size={18} aria-hidden="true" /></a></section>
    <section className="mf-access" aria-labelledby="access-heading">
      <div><h2 id="access-heading">Use MarketFit where you are</h2><p>The same tools, with another way to reach them.</p></div>
      <div className="mf-access-links">
        <Link href="/dashboard/whatsapp"><MessageCircle size={19} aria-hidden="true" /><span>WhatsApp<small>Send a resume and job post</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
        <Link href="/dashboard/extension"><Puzzle size={19} aria-hidden="true" /><span>Chrome extension<small>Use while applying for jobs</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
    <details className="mf-more"><summary>Find another tool</summary>
      <nav aria-label="All dashboard tools"><Link href="/dashboard/today">Today</Link><Link href="/dashboard/brief">My progress</Link><Link href="/dashboard/jobs">Find jobs</Link><Link href="/dashboard/calendar">Interview calendar · preview</Link><Link href="/dashboard/mail">Combined inbox · preview</Link><Link href="/dashboard/workflows">Email follow-ups · preview</Link><Link href="/dashboard/connections">Connected accounts</Link></nav>
    </details>
  </div>
}
