// The landing page (design system 2, 14 Oct 2026).
//
// The owner: "it looks so official and so real and legal [elsewhere] and mine just looks like a very non-branded,
// low-key kind of a thing ... make it look like a real product ... calm, warm, organised, hopeful". So the page follows
// the shape people already know from product sites: a clear promise, how it works, what is inside, the price, the
// questions, and one action at the end.
//
// Everything on it is true. The page it replaces carried customer stories that never happened (named people "landing
// at Stripe" and "at Meta"), counts nobody had measured, a comparison table against a competitor, and prices for plans
// and features that did not exist. None of that is here. The numbers that are here come from the product itself.

import Link from "next/link"
import { ArrowRight, Check, Clock, FileText, FolderOpen, Inbox, Lock, MessageCircle, Mic, ShieldCheck, Sparkles, CalendarCheck } from "lucide-react"
import { PLANS } from "@/lib/plans"
import { JoinList, LandingNav, Reveal } from "./_landing/landing-client"

const ink = "text-[var(--text)]", muted = "text-[var(--text-muted)]", soft = "text-[var(--text-soft)]"
// The serif carries the brand on this page. `font-display` is a plain class in globals.css, so it wins over the
// product's own rule that headings are set in the reading face.
const display = "font-display tracking-[-0.02em]"
const card = "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[13px] font-semibold text-[var(--accent)] shadow-[var(--shadow-card)]"><span className="size-1.5 rounded-full bg-[var(--accent)]" />{children}</p>
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[14px] font-semibold text-[var(--accent)]">{eyebrow}</p>
      <h2 className={`${display} ${ink} mt-3 text-[34px] font-semibold leading-[1.15] sm:text-[42px]`}>{title}</h2>
      {sub && <p className={`${muted} mt-4 text-[17px] leading-[1.65]`}>{sub}</p>}
    </div>
  )
}

/** An example of what the bot sends, drawn in the page itself. Marked as an example: the numbers are illustrative. */
function ProductPicture() {
  return (
    <div className={`${card} relative overflow-hidden p-0 shadow-[var(--shadow-pop)]`} aria-label="An example of a resume made on WhatsApp">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3.5">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--accent)] font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--bg)]">MF</span>
        <div className="min-w-0">
          <p className={`${ink} text-[14.5px] font-semibold`}>MarketFit</p>
          <p className={`${soft} text-[12.5px]`}>on WhatsApp</p>
        </div>
        <span className={`${soft} ml-auto rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11.5px] font-semibold`}>Example</span>
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] px-4 py-3 text-[14px] leading-[1.55] text-[var(--text)]">
          Senior SOC Analyst, remote. Splunk, Sentinel, incident response, threat hunting…
          <span className={`${soft} mt-1 block text-[12px]`}>1</span>
        </div>
        <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14px] leading-[1.55] text-[var(--text)]">
          Tailoring from your saved <b>SIEM and Incident Response</b> resume, which already shows 9 of the 10 things this job asks for…
        </div>
        <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))]"><FileText size={20} className="text-[var(--accent)]" /></span>
            <div className="min-w-0">
              <p className={`${ink} truncate text-[14px] font-semibold`}>Dana_Resume.docx</p>
              <p className={`${soft} text-[12.5px]`}>Word file · your own layout</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
            <p className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5"><span className={soft}>Match</span> <b className={ink}>64% → 93%</b></p>
            <p className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5"><span className={soft}>Years kept</span> <b className={ink}>exactly</b></p>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { icon: MessageCircle, title: "Send the job", text: "Paste a job description on the site, or send it on WhatsApp. If you keep resumes under two emails, say which one." },
  { icon: Sparkles, title: "Get your resume back", text: "About a minute later: your own Word file, rewritten to fit that job. Your years of experience and your titles stay exactly as you wrote them." },
  { icon: FolderOpen, title: "It is kept for next time", text: "Every resume is filed by email and kind of job. The next job starts from the closest one you already have, and the same job is never made twice." },
]

const FEATURES = [
  { icon: FileText, title: "Resumes fitted to each job", text: "Skills and experience lines rewritten to the job description, in your own Word layout. Nothing is added that is not in your resume.", wide: true },
  { icon: Inbox, title: "Your recruiter inbox, in order", text: "Connect Gmail and see whose turn it is, the right-to-represent and rate-confirmation mails still waiting, and who to follow up with." },
  { icon: CalendarCheck, title: "Interviews you never lose track of", text: "Every interview stays in view until you say how it ended, with a calm follow-up suggested at the right time." },
  { icon: Mic, title: "Interview practice", text: "Practise answering the questions this job is likely to ask, at your own pace, before the real call." },
  { icon: MessageCircle, title: "On WhatsApp, where recruiters already are", text: "Send a job, get the file back, reply to the file to change it. Nothing new to install.", wide: true },
]

const FAQ = [
  ["Will it make things up?", "No. Your years of experience and your seniority are kept exactly as you wrote them, and nothing is added that is not in your resume. If a resume ever changes them, it does not count against your pack."],
  ["Is my resume safe?", "Your information is not sold and is not used to train anyone's AI models. You can delete any resume from your library at any time, and your account with it."],
  ["Do I need a card to try it?", "No. Your first tailored resume is free. Check it against your own before you decide."],
  ["What happens when I pay?", "A pack is paid once and nothing renews. A monthly plan tells you three days before it renews, and you can cancel any time. Payments are opening soon; join the list for the plan you want."],
  ["Does it work for PDF resumes?", "Yes. A PDF is kept as it is, and a Word copy with the same words is made to tailor from."],
  ["Who is it for?", "IT consultants and contractors who are marketed through staffing firms and recruiters, and anyone who sends a tailored resume for each job."],
]

export default function Home() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <LandingNav />
      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 sm:pt-36">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-4xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)] blur-2xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 lg:grid-cols-[1.05fr_.95fr] lg:pb-28">
            <Reveal>
              <Eyebrow>For IT consultants and contractors</Eyebrow>
              <h1 className={`${display} ${ink} mt-6 text-[44px] font-semibold leading-[1.06] sm:text-[58px]`}>
                Your resume, fitted to every job. <span className="text-[var(--accent)]">In a minute.</span>
              </h1>
              <p className={`${muted} mt-6 max-w-xl text-[18px] leading-[1.65]`}>
                Send a job description on WhatsApp or paste it here. MarketFit rewrites your own resume to fit it, keeps your years and titles exactly as you wrote them, and files it so the next one starts closer.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 text-[16px] font-semibold text-[var(--bg)] shadow-[0_1px_2px_rgba(25,20,10,.16)] transition-[background,box-shadow,transform] hover:bg-[var(--accent-h)] hover:shadow-[0_10px_24px_-10px_rgba(25,20,10,.35)] active:scale-[.98]">
                  Get your first resume free <ArrowRight size={18} className="text-[var(--bg)]" />
                </Link>
                <a href="#how" className="inline-flex h-12 items-center rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] px-6 text-[16px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--text-soft)]">See how it works</a>
              </div>
              <ul className={`${soft} mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px]`}>
                {["First resume free", "No card", "Pay once, nothing renews"].map(t => <li key={t} className="flex items-center gap-1.5"><Check size={15} className="text-[var(--accent)]" />{t}</li>)}
              </ul>
            </Reveal>
            <Reveal delay={120}><ProductPicture /></Reveal>
          </div>
        </section>

        {/* What is always true, said plainly */}
        <section aria-label="What you can count on" className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto grid max-w-6xl gap-px px-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Clock, "About a minute", "from job description to Word file"],
              [ShieldCheck, "Your experience, kept", "years and titles exactly as written"],
              [FolderOpen, "Filed for you", "by email and kind of job, never twice"],
              [Lock, "Yours alone", "not sold, deletable any time"],
            ].map(([Icon, title, text], i) => {
              const I = Icon as typeof Clock
              return (
                <div key={i} className="flex items-start gap-3 py-7 sm:px-4">
                  <I size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  <div><p className={`${ink} text-[15px] font-semibold`}>{title as string}</p><p className={`${muted} text-[14px]`}>{text as string}</p></div>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal><SectionHead eyebrow="How it works" title="Three steps. No new habits." sub="It works the way you already apply: a job comes in, a fitted resume goes out." /></Reveal>
            <ol className="mt-16 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 90}>
                  <li className={`${card} h-full p-7`}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_13%,var(--surface))]"><step.icon size={21} className="text-[var(--accent)]" /></span>
                      <span className={`${soft} text-[14px] font-semibold`}>Step {i + 1}</span>
                    </div>
                    <h3 className={`${ink} mt-5 text-[19px] font-bold`}>{step.title}</h3>
                    <p className={`${muted} mt-2.5 text-[15.5px] leading-[1.65]`}>{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* What is inside */}
        <section id="product" className="scroll-mt-20 bg-[var(--surface-2)] py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal><SectionHead eyebrow="What is inside" title="One calm place for the whole search" sub="The resume is where it starts. The rest keeps everything after it in order." /></Reveal>
            <div className="mt-16 grid gap-5 md:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 80} className={f.wide ? "md:col-span-2" : ""}>
                  <div className={`${card} h-full p-7 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]`}>
                    <span className="grid size-11 place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_13%,var(--surface))]"><f.icon size={21} className="text-[var(--accent)]" /></span>
                    <h3 className={`${ink} mt-5 text-[19px] font-bold`}>{f.title}</h3>
                    <p className={`${muted} mt-2.5 max-w-xl text-[15.5px] leading-[1.65]`}>{f.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal><SectionHead eyebrow="Pricing" title="Start free. Pay only for what you use." sub="Every plan is paid before the work, so nothing ever surprises you on your card. Payments are opening soon: join the list for the plan you want." /></Reveal>
            <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 70}>
                  <div className={`relative flex h-full flex-col rounded-[var(--radius-lg)] border bg-[var(--surface)] p-6 ${plan.highlight ? "border-[var(--accent)] shadow-[var(--shadow-card-hover)]" : "border-[var(--border)] shadow-[var(--shadow-card)]"}`}>
                    {plan.highlight && <span className="absolute -top-3 left-6 rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-semibold text-[var(--bg)]">Most chosen</span>}
                    <p className={`${ink} text-[16px] font-bold`}>{plan.name}</p>
                    <p className="mt-4 flex items-baseline gap-1.5"><span className={`${ink} text-[38px] font-bold tracking-[-0.03em]`}>{plan.price}</span><span className={`${soft} text-[14.5px]`}>{plan.per}</span></p>
                    <p className={`${muted} mt-3 min-h-[48px] text-[14.5px] leading-[1.55]`}>{plan.blurb}</p>
                    <ul className="mt-5 flex-1 space-y-2.5">
                      {plan.features.map(f => <li key={f} className={`${ink} flex gap-2.5 text-[14.5px] leading-[1.5]`}><Check size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />{f}</li>)}
                    </ul>
                    <div className="mt-7">
                      {plan.action === "signup"
                        ? <Link href="/signup" className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface)] text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--text-soft)]">{plan.cta}</Link>
                        : <JoinList plan={plan.id} label={plan.cta} highlight={plan.highlight} />}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className={`${soft} mx-auto mt-8 max-w-2xl text-center text-[13.5px]`}>Prices in US dollars, before any sales tax. Packs never expire. A monthly plan can be cancelled any time.</p>
          </div>
        </section>

        {/* Questions */}
        <section id="faq" className="scroll-mt-20 border-t border-[var(--border)] bg-[var(--surface)] py-24 sm:py-28">
          <div className="mx-auto max-w-3xl px-5">
            <Reveal><SectionHead eyebrow="Questions" title="Before you start" /></Reveal>
            <div className="mt-12 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className={`${ink} flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold`}>
                    {q}
                    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className={`${muted} mt-3 pr-10 text-[15.5px] leading-[1.7]`}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* The one action */}
        <section className="py-24">
          <Reveal>
            <div className="mx-auto max-w-4xl px-5">
              <div className="relative overflow-hidden rounded-[22px] bg-[var(--accent)] px-8 py-14 text-center shadow-[var(--shadow-pop)] sm:px-14">
                <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.18),transparent)]" />
                <h2 className={`${display} text-[32px] font-semibold leading-[1.15] text-[var(--bg)] sm:text-[40px]`}>Your next role starts with the next resume.</h2>
                <p className="mx-auto mt-4 max-w-xl text-[17px] leading-[1.6] text-[color-mix(in_srgb,var(--bg)_86%,transparent)]">Try it on a job you are applying to today. The first one is free.</p>
                <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-[12px] bg-[var(--bg)] px-6 text-[16px] font-semibold text-[var(--text)] shadow-[0_1px_2px_rgba(25,20,10,.2)] transition-transform hover:-translate-y-0.5 active:scale-[.98]">
                  Get your free resume <ArrowRight size={18} className="text-[var(--text)]" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-[8px] bg-[var(--accent)] font-[family-name:var(--font-display)] text-[11px] font-bold text-[var(--bg)]">MF</span>
            <span className={`${muted} text-[14px]`}>© 2026 MarketFit</span>
          </div>
          <nav aria-label="Footer" className={`${muted} flex flex-wrap gap-x-6 gap-y-2 text-[14px]`}>
            <a href="#pricing" className="hover:text-[var(--text)]">Pricing</a>
            <a href="#faq" className="hover:text-[var(--text)]">Questions</a>
            <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
            <Link href="/login" className="hover:text-[var(--text)]">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
