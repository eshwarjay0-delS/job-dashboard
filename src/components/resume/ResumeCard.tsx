'use client';
import { useState } from 'react';
import Button from '@/components/ui/AppButton';
import Badge from '@/components/ui/AppBadge';

interface ResumeCardProps {
  id: string;
  name: string;
  atsScore?: number;
  updatedAt?: string;
  onEdit?: (id: string) => void;
  onDownload?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}

function gradeFromScore(score: number) {
  if (score >= 90) return { grade: 'A', color: '#10b981' };
  if (score >= 80) return { grade: 'B', color: '#2563eb' };
  if (score >= 70) return { grade: 'C', color: '#f59e0b' };
  if (score >= 60) return { grade: 'D', color: '#f97316' };
  return { grade: 'F', color: '#ef4444' };
}

export default function ResumeCard({ id, name, atsScore = 0, updatedAt, onEdit, onDownload, onRename }: ResumeCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { grade, color } = gradeFromScore(atsScore);

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft !== name) onRename?.(id, draft.trim());
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col hover:border-[var(--accent)]/40 transition-colors group">
      {/* Thumbnail */}
      <div className="h-28 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--surface-2)] to-[var(--accent)]/10 flex items-center justify-center relative">
        <div className="absolute top-2 right-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold text-white" style={{ background: color }}>
            {grade}
          </span>
        </div>
        <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
          <rect width="40" height="50" rx="4" fill="var(--surface)"/>
          <rect x="6" y="8" width="28" height="3" rx="1.5" fill="var(--border)"/>
          <rect x="6" y="14" width="20" height="2" rx="1" fill="var(--border)"/>
          <rect x="6" y="20" width="28" height="1.5" rx="0.75" fill="var(--border)"/>
          <rect x="6" y="24" width="24" height="1.5" rx="0.75" fill="var(--border)"/>
          <rect x="6" y="30" width="28" height="1.5" rx="0.75" fill="var(--border)"/>
          <rect x="6" y="34" width="18" height="1.5" rx="0.75" fill="var(--border)"/>
        </svg>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            className="text-sm font-semibold bg-[var(--surface-2)] border border-[var(--accent)] rounded px-2 py-0.5 text-[var(--text)] focus:outline-none w-full"
          />
        ) : (
          <p
            className="text-sm font-semibold text-[var(--text)] truncate cursor-pointer hover:text-[var(--accent)] transition-colors"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {name}
          </p>
        )}
        {updatedAt && (
          <p className="text-xs text-[var(--text-muted)]">
            Updated {new Date(updatedAt).toLocaleDateString()}
          </p>
        )}
        {atsScore > 0 && (
          <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${atsScore}%`, background: color }} />
          </div>
        )}
        <div className="flex gap-2 mt-auto pt-1">
          <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => onEdit?.(id)}>Edit</Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => onDownload?.(id)}>↓ PDF</Button>
        </div>
      </div>
    </div>
  );
}
