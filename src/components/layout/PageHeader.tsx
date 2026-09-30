import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
}

/** Standard page-title row: icon + title + badge, description below, actions
 * pinned right, closed by a hairline rule. Every dashboard page should build its header
 * from this instead of hand-rolling the same flex/font-size combination each time. */
export default function PageHeader({ title, description, icon, badge, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 28, paddingBottom: 20,
      borderBottom: '0.8px solid var(--border-strong)', flexWrap: 'wrap',
    }}>
      {icon && (
        <div style={{
          width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: 'var(--accent)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h1>
          {badge}
        </div>
        {description && (
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-muted)', margin: '8px 0 0', maxWidth: 660 }}>{description}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  )
}
