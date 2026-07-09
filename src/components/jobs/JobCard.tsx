'use client';
import { JobFeedItem } from '@/types/jobs';
import ProgressRing from '@/components/ui/ProgressRing';
import Badge from '@/components/ui/AppBadge';
import Button from '@/components/ui/AppButton';

interface JobCardProps {
  job: JobFeedItem;
  selected?: boolean;
  onSelect?: (job: JobFeedItem) => void;
  onSave?: (job: JobFeedItem) => void;
  onNotInterested?: (id: string) => void;
  saved?: boolean;
}

function companyInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return '1d ago';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function JobCard({ job, selected, onSelect, onSave, onNotInterested, saved }: JobCardProps) {
  const score = job.matchScore?.overall ?? 0;
  const tier = job.matchScore?.tier ?? 'fair';
  const tierBadge = tier === 'strong' ? 'match-strong' : tier === 'good' ? 'match-good' : 'match-fair';

  return (
    <div
      onClick={() => onSelect?.(job)}
      className={`group bg-[var(--surface)] border rounded-xl p-4 flex gap-3 cursor-pointer transition-all duration-150 hover:border-[var(--accent)]/50 hover:-translate-y-0.5 hover:shadow-md
        ${selected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/40' : 'border-[var(--border)]'}`}
    >
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] flex-shrink-0 flex items-center justify-center overflow-hidden">
        {job.company_logo ? (
          <img src={job.company_logo} alt={job.company} className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs font-bold text-[var(--text-muted)]">{companyInitials(job.company)}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="font-semibold text-[var(--text)] text-sm leading-snug truncate">{job.title}</p>
          {job.is_urgent && <Badge variant="urgent">Urgent</Badge>}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{job.company} · {job.location}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {score > 0 && <Badge variant={tierBadge}>{score}% match</Badge>}
          {job.work_model && (
            <Badge variant="info">{job.work_model}</Badge>
          )}
          {job.h1b_score !== undefined && job.h1b_score >= 60 && (
            <Badge variant={job.h1b_score >= 80 ? 'h1b-likely' : 'h1b-possible'}>
              H1B {job.h1b_score >= 80 ? 'likely' : 'possible'}
            </Badge>
          )}
          {job.salary_min && (
            <span className="text-xs text-[var(--text-muted)]">
              ${(job.salary_min / 1000).toFixed(0)}k{job.salary_max ? `–${(job.salary_max / 1000).toFixed(0)}k` : '+'}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)] ml-auto">{timeAgo(job.posted_at)}</span>
        </div>

        {/* Action row */}
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost" size="sm"
            onClick={e => { e.stopPropagation(); onSave?.(job); }}
            className="text-xs"
          >
            {saved ? '★ Saved' : '☆ Save'}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={e => { e.stopPropagation(); onNotInterested?.(job.id); }}
            className="text-xs"
          >
            Not interested
          </Button>
        </div>
      </div>

      {/* Progress Ring */}
      {score > 0 && (
        <div className="flex-shrink-0 self-center">
          <ProgressRing value={score} size={56} strokeWidth={4} />
        </div>
      )}
    </div>
  );
}
