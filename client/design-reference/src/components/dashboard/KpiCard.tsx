import React from 'react';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

type Tone = 'danger' | 'warn' | 'brand' | 'neutral';

interface KpiCardProps {
  label: string;
  value: string;
  caption: string;
  delta: string;
  deltaDirection: 'up' | 'down';
  deltaIsBad?: boolean;
  tone: Tone;
  emphasis?: boolean;
}

const toneStyles: Record<Tone, {card: string;value: string;rail: string;}> = {
  danger: { card: 'bg-danger-10 border-danger-25', value: 'text-danger', rail: 'bg-danger' },
  warn: { card: 'bg-warn-10 border-warn-25', value: 'text-[#9A6A28]', rail: 'bg-warn' },
  brand: { card: 'bg-white border-neutral-200', value: 'text-brand', rail: 'bg-brand' },
  neutral: { card: 'bg-white border-neutral-200', value: 'text-ink', rail: 'bg-navy' }
};

export function KpiCard({
  label,
  value,
  caption,
  delta,
  deltaDirection,
  deltaIsBad = false,
  tone,
  emphasis = false
}: KpiCardProps) {
  const styles = toneStyles[tone];
  const DeltaIcon = deltaDirection === 'up' ? TrendingUpIcon : TrendingDownIcon;

  return (
    <article className={`relative overflow-hidden rounded-lg border p-4 ${styles.card}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${styles.rail}`} aria-hidden="true" />
      <p className="text-2xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`num mt-1.5 font-semibold tracking-tight ${styles.value} ${
        emphasis ? 'text-4xl' : 'text-2xl'}`
        }>
        
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-2xs text-neutral-500">{caption}</p>
        <span
          className={`inline-flex items-center gap-1 text-2xs font-semibold ${
          deltaIsBad ? 'text-danger' : 'text-[#00753A]'}`
          }>
          
          <DeltaIcon className="h-3 w-3" aria-hidden="true" />
          {delta}
        </span>
      </div>
    </article>);

}