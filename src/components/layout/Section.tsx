import { ReactNode } from 'react'

interface SectionProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** A titled content block with consistent vertical rhythm (12px gap under
 * the heading, 28px gap before the next section). Use this instead of an
 * ad hoc <h2> + <div> pair so every page's section spacing matches. */
export default function Section({ title, description, actions, children, className = '' }: SectionProps) {
  return (
    <section className={className} style={{ marginBottom: 28 }}>
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            {title && <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>}
            {description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>{description}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
