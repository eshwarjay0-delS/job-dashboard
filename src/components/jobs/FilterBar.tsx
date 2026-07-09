'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const FILTERS = [
  { key: 'role',       label: 'Role',        options: ['Software Engineer', 'Frontend', 'Backend', 'Full Stack', 'DevOps', 'Data Engineer', 'ML Engineer', 'Product Manager', 'Designer'] },
  { key: 'level',      label: 'Level',       options: ['Intern', 'Entry', 'Mid', 'Senior', 'Staff', 'Principal', 'Manager', 'Director'] },
  { key: 'workModel',  label: 'Work Model',  options: ['remote', 'hybrid', 'onsite'] },
  { key: 'workType',   label: 'Type',        options: ['full-time', 'part-time', 'contract', 'internship'] },
  { key: 'datePosted', label: 'Posted',      options: ['24h', '3d', '1w', '2w', '1mo'] },
  { key: 'yearsExp',   label: 'Experience',  options: ['0-1', '1-3', '3-5', '5-8', '8+'] },
  { key: 'h1b',        label: 'H1B',         options: ['any', 'likely', 'possible'] },
  { key: 'location',   label: 'Location',    options: ['Remote', 'New York', 'San Francisco', 'Austin', 'Seattle', 'Chicago', 'Boston'] },
] as const;

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setFilter = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    if (value === '' || p.get(key) === value) p.delete(key);
    else p.set(key, value);
    router.push(`${pathname}?${p.toString()}`);
  }, [params, router, pathname]);

  const clearAll = () => router.push(pathname);
  const activeCount = FILTERS.filter(f => params.get(f.key)).length;

  return (
    <div className="flex items-center gap-2 flex-wrap py-3 border-b border-[var(--border)]">
      {FILTERS.map(f => {
        const active = params.get(f.key);
        return (
          <div key={f.key} className="relative group">
            <select
              value={active ?? ''}
              onChange={e => setFilter(f.key, e.target.value)}
              className={`appearance-none pl-3 pr-7 py-1.5 text-xs rounded-lg border cursor-pointer focus:outline-none transition-colors
                ${active
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)] font-medium'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50'
                }`}
            >
              <option value="">{f.label}</option>
              {f.options.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">▾</span>
          </div>
        );
      })}
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="text-xs text-[var(--danger)] hover:opacity-80 transition-opacity ml-1"
        >
          Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
