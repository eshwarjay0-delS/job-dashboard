'use client';
import { useEffect, useState } from 'react';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  /** CSS color value. Accepts any valid CSS color string, including var(--token). */
  color?: string;
  trackColor?: string;
  label?: string;
  animate?: boolean;
}

const tierColor = (v: number) =>
  v >= 80 ? 'var(--success)' : v >= 60 ? 'var(--accent)' : v >= 40 ? 'var(--warning)' : 'var(--danger)';

export default function ProgressRing({
  value,
  size = 64,
  strokeWidth = 5,
  color,
  trackColor = 'var(--border)',
  label,
  animate = true,
}: ProgressRingProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate) { setDisplayed(value); return; }
    const t = setTimeout(() => setDisplayed(value), 80);
    return () => clearTimeout(t);
  }, [value, animate]);

  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;
  const c = color ?? tierColor(value);
  const center = size / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={c} strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: animate ? 'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)' : 'none' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none" style={{ fontSize: size * 0.22, color: c }}>{value}</span>
        {label && <span className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: size * 0.14 }}>{label}</span>}
      </div>
    </div>
  );
}
