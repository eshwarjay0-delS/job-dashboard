'use client';
import ProgressRing from '@/components/ui/ProgressRing';

interface ScoreDisplayProps {
  overall: number;
  skills?: number;
  identity?: number;
  experience?: number;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-semibold text-[var(--text)]">{value}%</span>
      </div>
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreDisplay({ overall, skills = 0, identity = 0, experience = 0 }: ScoreDisplayProps) {
  return (
    <div className="flex items-center gap-6">
      <ProgressRing value={overall} size={80} strokeWidth={6} label="ATS" />
      <div className="flex-1 flex flex-col gap-3">
        <ScoreBar label="Skills Coverage" value={skills} color="#2563eb" />
        <ScoreBar label="Identity & Keywords" value={identity} color="#10b981" />
        <ScoreBar label="Experience Depth" value={experience} color="#f59e0b" />
      </div>
    </div>
  );
}
