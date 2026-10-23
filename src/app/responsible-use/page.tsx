// Responsible use (public): what Kompas is for, and where an employer asks not to have it used in its interviews.
// Approved 23 Oct 2026 ("add all", competitor idea 17). The page states rules for using Kompas; it makes no promise of
// hiding anything from an interviewer or a test proctor, and nothing on it should ever be changed to make one.

import type { Metadata } from "next"
import Link from "next/link"
import PublicPage from "@/components/PublicPage"
import { BlocklistForm } from "./blocklist-form"

export const metadata: Metadata = {
  title: "Responsible use",
  description: "Kompas is for interview practice and for conversations where AI help is allowed. Employers can ask to be blocklisted.",
}

const card = "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"

const RULES: [string, string][] = [
  ["Practise as much as you like.", "Mock interviews and questions for the job you applied to are what Kompas is built for."],
  ["In a real interview, only where AI help is allowed.", "Use Kompas in a live interview, assessment or exam only if the employer or organiser allows AI help. If you are not sure, ask them first, or do not use it."],
  ["Never to hide AI help.", "Kompas is not for hiding AI help from an interviewer or a test proctor. Where the rules forbid it, do not use it."],
  ["Your answers are about you.", "What you say about your experience must be true. Kompas helps you practise saying it well; it does not change what is true."],
]

export default function ResponsibleUsePage() {
  return (
    <PublicPage eyebrow="Responsible use" title="Kompas is for practice" lede="Kompas is an interview practice companion. Use it to practise, and in conversations where AI help is allowed.">
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {RULES.map(([title, text]) => (
          <li key={title} className={`${card} p-6`}>
            <h2 className="text-[17px] font-bold text-[var(--text)]">{title}</h2>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--text-muted)]">{text}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="employers" className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h2 id="employers" className="font-display text-[26px] font-semibold leading-[1.2] text-[var(--text)]">For employers</h2>
          <p className="mt-4 text-[15.5px] leading-[1.65] text-[var(--text-muted)]">
            If you do not want Kompas used in your interviews, ask to be added to our blocklist. A person reads every request and replies to the email you give. Nothing changes automatically when you send it.
          </p>
          <p className="mt-4 text-[15.5px] leading-[1.65] text-[var(--text-muted)]">
            We keep only what you type in this form, to review your request and reply to you. See our <Link href="/privacy" className="font-semibold text-[var(--accent)]">Privacy Policy</Link>.
          </p>
        </div>
        <div className={`${card} p-6`}>
          <BlocklistForm />
        </div>
      </section>
    </PublicPage>
  )
}
