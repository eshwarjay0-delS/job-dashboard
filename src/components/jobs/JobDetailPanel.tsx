'use client';
import { JobFeedItem } from '@/types/jobs';
import ProgressRing from '@/components/ui/ProgressRing';
import Badge from '@/components/ui/AppBadge';
import Button from '@/components/ui/AppButton';
import { useState } from 'react';

interface JobDetailPanelProps {
  job: JobFeedItem | null;
  onClose: () => void;
  onSave?: (job: JobFeedItem) => void;
  saved?: boolean;
}

const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text)]">{value}%</span>
    </div>
    <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
);

export default function JobDetailPanel({ job, onClose, onSave, saved }: JobDetailPanelProps) {
  const [tab, setTab] = useState<'overview' | 'match' | 'company'>('overview');

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${job ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-[var(--surface)] border-l border-[var(--border)] z-50 flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 ${job ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {!job ? null : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 p-5 border-b border-[var(--border)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[var(--text-muted)]">
                {job.company_logo
                  ? <img src={job.company_logo} alt={job.company} className="w-full h-full object-contain rounded-xl" />
                  : job.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-[var(--text)] text-base leading-snug">{job.title}</h2>
                <p className="text-sm text-[var(--text-muted)]">{job.company} · {job.location}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {job.work_model && <Badge variant="info">{job.work_model}</Badge>}
                  {job.work_type && <Badge variant="default">{job.work_type}</Badge>}
                  {job.h1b_score !== undefined && job.h1b_score >= 60 && (
                    <Badge variant={job.h1b_score >= 80 ? 'h1b-likely' : 'h1b-possible'}>
                      H1B {job.h1b_score >= 80 ? 'likely' : 'possible'}
                    </Badge>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none flex-shrink-0">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              {(['overview', 'match', 'company'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors
                    ${tab === t ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {tab === 'overview' && (
                <>
                  {job.salary_min && (
                    <div className="flex items-center gap-2 p-3 bg-[var(--surface-2)] rounded-lg">
                      <span className="text-lg">💰</span>
                      <span className="text-sm font-medium text-[var(--text)]">
                        ${(job.salary_min / 1000).toFixed(0)}k – ${((job.salary_max ?? job.salary_min * 1.3) / 1000).toFixed(0)}k / yr
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Description</h3>
                    <p className="text-sm text-[var(--text)] whitespace-pre-line leading-relaxed">{job.description}</p>
                  </div>
                  {job.skills && job.skills.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Skills Required</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {job.skills.map(s => {
                          const matched = job.matchScore?.matchedSkills.map(m => m.toLowerCase()).includes(s.toLowerCase());
                          return (
                            <span key={s} className={`px-2 py-1 rounded-full text-xs font-medium border ${matched ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]'}`}>
                              {matched ? '✓ ' : ''}{s}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === 'match' && job.matchScore && (
                <>
                  <div className="flex items-center gap-4 p-4 bg-[var(--surface-2)] rounded-xl">
                    <ProgressRing value={job.matchScore.overall} size={80} strokeWidth={6} />
                    <div>
                      <p className="text-lg font-bold text-[var(--text)]">{job.matchScore.overall}% Match</p>
                      <p className="text-sm text-[var(--text-muted)] capitalize">{job.matchScore.tier} fit</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ScoreBar label="Skills" value={job.matchScore.skills} color="#2563eb" />
                    <ScoreBar label="Experience" value={job.matchScore.experience} color="#10b981" />
                    <ScoreBar label="Education" value={job.matchScore.education} color="#f59e0b" />
                    <ScoreBar label="Location" value={job.matchScore.location} color="#8b5cf6" />
                  </div>
                  {job.matchScore.missingSkills.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Skill Gaps</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {job.matchScore.missingSkills.map(s => (
                          <span key={s} className="px-2 py-1 rounded-full text-xs bg-red-500/10 border border-red-500/20 text-red-400">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === 'company' && (
                <div className="flex flex-col items-center py-8 gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                    {job.company.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-bold text-[var(--text)] text-lg">{job.company}</p>
                  <p className="text-sm text-[var(--text-muted)]">{job.location}</p>
                </div>
              )}
            </div>

            {/* Footer CTAs */}
            <div className="p-4 border-t border-[var(--border)] flex gap-2">
              <Button
                variant="secondary" size="md"
                onClick={() => onSave?.(job)}
                className="flex-1"
              >
                {saved ? '★ Saved' : '☆ Save'}
              </Button>
              <Button
                variant="primary" size="md"
                onClick={() => window.open(job.apply_url, '_blank')}
                className="flex-1"
              >
                Apply Now →
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
