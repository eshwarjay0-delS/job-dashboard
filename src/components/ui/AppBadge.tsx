import { ReactNode } from 'react';

type BadgeVariant =
  | 'match-strong' | 'match-good' | 'match-fair'
  | 'h1b-likely' | 'h1b-possible'
  | 'urgent' | 'new' | 'info' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  'match-strong': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  'match-good':   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'match-fair':   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  'h1b-likely':   'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  'h1b-possible': 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  'urgent':       'bg-red-500/15 text-red-400 border border-red-500/30',
  'new':          'bg-amber-500/15 text-amber-500 border border-amber-500/30',
  'info':         'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  'default':      'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]',
};

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variantMap[variant]} ${className}`}>
      {children}
    </span>
  );
}
