'use client';
import { useEffect, useState } from 'react';
import ScoreDisplay from './ScoreDisplay';
import Button from '@/components/ui/AppButton';

interface ATSIssue {
  type: 'urgent' | 'critical' | 'optional';
  message: string;
}

interface ATSData {
  overall: number;
  skills: number;
  identity: number;
  experience: number;
  issues: ATSIssue[];
}

interface ATSScoreWidgetProps {
  resumeId?: string;
  resumeText?: string;
}

const ISSUE_COLOR: Record<ATSIssue['type'], string> = {
  urgent:   'text-red-400 bg-red-500/10 border-red-500/20',
  critical: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  optional: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

export default function ATSScoreWidget({ resumeId, resumeText }: ATSScoreWidgetProps) {
  const [data, setData] = useState<ATSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resumeId && !resumeText) return;
    setLoading(true);
    setError('');
    const url = resumeId ? `/api/resumes/${resumeId}/ats-score` : '/api/resumes/ats-score';
    const options = resumeText
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: resumeText }) }
      : undefined;
    fetch(url, options)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Could not load ATS score'); setLoading(false); });
  }, [resumeId, resumeText]);

  if (loading) return (
    <div className="flex items-center gap-3 p-4 bg-[var(--surface-2)] rounded-xl animate-pulse">
      <div className="w-20 h-20 rounded-full bg-[var(--border)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[var(--border)] rounded w-3/4" />
        <div className="h-3 bg-[var(--border)] rounded w-1/2" />
      </div>
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
  );

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <ScoreDisplay overall={data.overall} skills={data.skills} identity={data.identity} experience={data.experience} />
      {data.issues?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Issues Found</p>
          {data.issues.map((issue, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${ISSUE_COLOR[issue.type]}`}>
              <span className="flex-shrink-0 font-bold uppercase text-[10px] mt-0.5">{issue.type}</span>
              <span className="flex-1">{issue.message}</span>
              <Button variant="ghost" size="sm" className="text-xs flex-shrink-0">Fix</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
