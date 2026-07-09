'use client';
import { useEffect, useState } from 'react';
import ResumeCard from './ResumeCard';
import EmptyState from '@/components/ui/EmptyState';

interface ResumeEntry {
  id: string;
  name: string;
  atsScore?: number;
  updatedAt?: string;
  category?: string;
}

type SortKey = 'modified' | 'score' | 'name';
type Category = 'all' | 'base' | 'tailored' | 'archived';

const CATS: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'base', label: 'Base' },
  { id: 'tailored', label: 'Tailored' },
  { id: 'archived', label: 'Archived' },
];

export default function ResumeLibrary() {
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [category, setCategory] = useState<Category>('all');
  const [sort, setSort] = useState<SortKey>('modified');

  useEffect(() => {
    const raw = localStorage.getItem('jd_resumes');
    if (raw) setResumes(JSON.parse(raw));
  }, []);

  function saveResumes(list: ResumeEntry[]) {
    setResumes(list);
    localStorage.setItem('jd_resumes', JSON.stringify(list));
  }

  function handleRename(id: string, name: string) {
    saveResumes(resumes.map(r => r.id === id ? { ...r, name } : r));
  }

  const filtered = resumes
    .filter(r => category === 'all' || (r.category ?? 'base') === category)
    .sort((a, b) => {
      if (sort === 'modified') return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
      if (sort === 'score') return (b.atsScore ?? 0) - (a.atsScore ?? 0);
      return a.name.localeCompare(b.name);
    });

  const MAX_SLOTS = 10;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {CATS.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors
                ${category === c.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Sort:</span>
          {(['modified', 'score', 'name'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-2 py-1 rounded transition-colors capitalize ${sort === s ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Slot usage */}
      <div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>Resume slots</span>
          <span>{resumes.length} / {MAX_SLOTS}</span>
        </div>
        <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${(resumes.length / MAX_SLOTS) * 100}%` }} />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon="📄" title="No resumes yet" description="Upload a resume to get started." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(r => (
            <ResumeCard
              key={r.id}
              id={r.id}
              name={r.name}
              atsScore={r.atsScore}
              updatedAt={r.updatedAt}
              onEdit={id => window.location.href = `/dashboard/resume?id=${id}`}
              onRename={handleRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
