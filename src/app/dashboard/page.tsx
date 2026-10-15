import { authenticatedUser } from "@/lib/authBoundary"
import { isResumeOnlyAccount } from "@/lib/resumeOnlyEntitlement"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, Mail, Mic, ArrowRight, MessageCircle, Puzzle, Sun, NotebookPen, Briefcase, CalendarDays, Repeat, Link2 } from "lucide-react"

// The look (design system 2, 14 Oct 2026): the start page people know from the apps they use. One warm line, the three
// things MarketFit does as three cards you can press anywhere, then the other ways in and every other tool, all in view.
const start = [
  { title: "Fit my resume to a job", text: "Choose your resume, paste the job post, and see what changed before you send it.", href: "/dashboard/resume", icon: FileText,
    links: [{ href: "/dashboard/documents", label: "My files" }, { href: "/dashboard/resume/builder", label: "Build a resume" }] },
  { title: "Check my job mail", text: "Recruiter mail from your Gmail, sorted by who is waiting on whom.", href: "/dashboard/mail", icon: Mail,
    links: [{ href: "/dashboard/connections", label: "Connect Gmail" }, { href: "/dashboard/tracker", label: "My applications" }] },
  { title: "Practice an interview", text: "Speak or type your answers with Kompas, and hear how you come across.", href: "/dashboard/kompas", icon: Mic,
    links: [{ href: "/dashboard/kompas/flow", label: "Speech to text" }] },
]

const elsewhere = [
  { title: "WhatsApp", text: "Send a resume and a job post, get the fitted resume back", href: "/dashboard/whatsapp", icon: MessageCircle },
  { title: "Chrome extension", text: "Use MarketFit on the page where you apply", href: "/dashboard/extension", icon: Puzzle },
]

const tools = [
  { label: "Today", href: "/dashboard/today", icon: Sun },
  { label: "Summary", href: "/dashboard/brief", icon: NotebookPen },
  { label: "Find jobs", href: "/dashboard/jobs", icon: Briefcase },
  { label: "Interviews", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Follow-ups", href: "/dashboard/workflows", icon: Repeat },
  { label: "Gmail accounts", href: "/dashboard/connections", icon: Link2 },
]

export default async function DashboardPage() {
  const user = await authenticatedUser()
  if (await isResumeOnlyAccount(user)) redirect("/dashboard/resume")
  return <div className="mf-home">
    <header className="mf-home-heading">
      <h1>What would you like to do?</h1>
      <p>Pick one to begin. Everything you make is kept in your files.</p>
    </header>

    <section className="mf-start" aria-label="Start here">
      {start.map(({ title, text, href, icon: Icon, links }) => <article className="mf-start-card" key={href}>
        <span className="mf-start-icon"><Icon size={22} aria-hidden="true" /></span>
        <h2><Link href={href} className="mf-start-link">{title}</Link></h2>
        <p>{text}</p>
        <span className="mf-start-go" aria-hidden="true">Open <ArrowRight size={16} /></span>
        <div className="mf-start-more">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
      </article>)}
    </section>

    <section className="mf-home-section" aria-labelledby="elsewhere-heading">
      <h2 id="elsewhere-heading">Use MarketFit where you are</h2>
      <div className="mf-row-links">
        {elsewhere.map(({ title, text, href, icon: Icon }) => <Link key={href} href={href}>
          <span className="mf-row-icon"><Icon size={18} aria-hidden="true" /></span>
          <span className="mf-row-text"><strong>{title}</strong><small>{text}</small></span>
          <ArrowRight size={16} aria-hidden="true" className="mf-row-arrow" />
        </Link>)}
      </div>
    </section>

    <section className="mf-home-section" aria-labelledby="tools-heading">
      <h2 id="tools-heading">More tools</h2>
      <nav className="mf-tool-grid" aria-label="All dashboard tools">
        {tools.map(({ label, href, icon: Icon }) => <Link key={href} href={href}><Icon size={17} aria-hidden="true" />{label}</Link>)}
      </nav>
    </section>
  </div>
}
