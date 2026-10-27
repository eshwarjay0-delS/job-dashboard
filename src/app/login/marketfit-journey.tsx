import { BriefcaseBusiness, CalendarDays, Check, FileText, Mail } from "lucide-react"
import styles from "./marketfit-journey.module.css"

/**
 * Brand storytelling only: the live login form stays usable if CSS or motion is disabled.
 * All artwork uses DOM and CSS instead of external media or a hydration-dependent canvas.
 */
export default function MarketFitJourney({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className={styles.mobileJourney} aria-hidden="true">
        <span className={styles.mobileStep}><FileText size={14} /> Resume</span>
        <span className={styles.mobileConnector}><span /></span>
        <span className={styles.mobileStep}><Check size={14} /> Match</span>
        <span className={styles.mobileConnector}><span /></span>
        <span className={styles.mobileStep}><CalendarDays size={14} /> Interview</span>
      </div>
    )
  }

  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.halo} />
      <div className={styles.document}>
        <div className={styles.cardTitle}><span className={styles.icon}><FileText size={15} /></span> YOUR EXPERIENCE</div>
        <div className={styles.docHeading} />
        <div className={styles.docLine} />
        <div className={styles.docLineShort} />
        <div className={styles.docRule} />
        <div className={styles.docLine} />
        <div className={styles.docLineMedium} />
        <div className={styles.docLineShort} />
      </div>

      <div className={styles.roleCard}>
        <div className={styles.cardTitle}><span className={styles.icon}><BriefcaseBusiness size={15} /></span> THE RIGHT ROLE</div>
        <div className={styles.roleHeading}>Your next opportunity</div>
        <div className={styles.tagRow}><span>Skills</span><span>Experience</span></div>
        <div className={styles.roleLine} />
        <div className={styles.roleLineShort} />
      </div>

      <div className={styles.matchBadge}><Check size={14} strokeWidth={2.5} /> Experience matched</div>
      <div className={styles.path}><span className={styles.travelDot} /></div>

      <div className={styles.mailCard}>
        <span className={styles.smallIcon}><Mail size={16} /></span>
        <span><strong>Recruiter mail</strong><small>All in one place</small></span>
      </div>
      <div className={styles.interviewCard}>
        <span className={styles.smallIcon}><CalendarDays size={16} /></span>
        <span><strong>Interview ready</strong><small>One calm next step</small></span>
      </div>
      <div className={styles.sparkleA} />
      <div className={styles.sparkleB} />
    </div>
  )
}
