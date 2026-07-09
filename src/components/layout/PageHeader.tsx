import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
}

/** Standard page-title row: icon + title + badge, description below, actions
 * pinned right. Every dashboard page should build its header from this
 * instead of hand-rolling the same flex/font-size combination each time. */
export default function PageHeader({ title, description, icon, badge, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {icon && (
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-h))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff',
        }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</h1>
          {badge}
        </div>
        {description && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>{description}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  )
}
