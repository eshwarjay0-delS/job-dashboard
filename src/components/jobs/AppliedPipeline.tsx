'use client';
import { useState, useEffect } from 'react';
import { ApplicationStatus, APPLICATION_STATUS_LABELS } from '@/types/matching';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/AppBadge';

interface Application {
  id: string;
  job_title: string;
  company: string;
  location?: string;
  applied_at: string;
  status: ApplicationStatus;
  notes?: string;
}

const TABS: ApplicationStatus[] = ['applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn'];

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  saved: 'default',
  applied: 'info',
  phone_screen: 'match-fair',
  interview: 'match-good',
  offer: 'match-strong',
  rejected: 'urgent',
  withdrawn: 'default',
};

export default function AppliedPipeline() {
  const [apps, setApps] = useState<Application[]>([]);
  const [tab, setTab] = useState<ApplicationStatus>('applied');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('jd_applications');
    if (raw) setApps(JSON.parse(raw));
    setLoading(false);
  }, []);

  function updateStatus(id: string, status: ApplicationStatus) {
    setApps(prev => {
      const next = prev.map(a => a.id === id ? { ...a, status } : a);
      localStorage.setItem('jd_applications', JSON.stringify(next));
      return next;
    });
  }

  const filtered = apps.filter(a => a.status === tab);

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const count = apps.filter(a => a.status === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                ${tab === t
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              {APPLICATION_STATUS_LABELS[t]}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === t ? 'bg-white/20' : 'bg-[var(--border)]'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title={`No ${APPLICATION_STATUS_LABELS[tab]} applications`}
          description="Applications you track will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(app => (
            <div key={app.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text)] text-sm">{app.job_title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{app.company}{app.location ? ` · ${app.location}` : ''}</p>
                </div>
                <Badge variant={STATUS_COLOR[app.status] as any}>{APPLICATION_STATUS_LABELS[app.status]}</Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Applied {new Date(app.applied_at).toLocaleDateString()}</p>
              {app.notes && <p className="text-xs text-[var(--text-muted)] italic">{app.notes}</p>}
              {/* Quick status update */}
              <div className="flex gap-1 flex-wrap mt-1">
                {TABS.filter(t => t !== app.status).slice(0, 4).map(t => (
                  <button
                    key={t}
                    onClick={() => updateStatus(app.id, t)}
                    className="text-xs px-2 py-1 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    → {APPLICATION_STATUS_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
