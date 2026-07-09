import { HTMLAttributes } from 'react';

function SkeletonBase({ className = '', style }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded bg-[var(--surface-2)] skeleton-shimmer ${className}`}
      style={style}
    />
  );
}

export function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <SkeletonBase style={{ width, height, borderRadius: 4 }} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '65%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex gap-4">
      <SkeletonBase className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonLine width="55%" height={16} />
        <SkeletonLine width="35%" height={13} />
        <div className="flex gap-2 mt-1">
          <SkeletonLine width={60} height={20} />
          <SkeletonLine width={70} height={20} />
        </div>
      </div>
      <SkeletonBase className="w-14 h-14 rounded-full flex-shrink-0" />
    </div>
  );
}

export function SkeletonResumeCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      <SkeletonBase className="w-full h-28 rounded-lg" />
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="40%" height={13} />
      <div className="flex gap-2 mt-1">
        <SkeletonBase className="flex-1 h-8 rounded-lg" />
        <SkeletonBase className="flex-1 h-8 rounded-lg" />
      </div>
    </div>
  );
}
