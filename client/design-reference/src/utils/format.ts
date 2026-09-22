export function formatNaira(value: number, options?: {compact?: boolean;}): string {
  if (options?.compact) {
    if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
    return `₦${value.toFixed(0)}`;
  }
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe % 3600 / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m remaining`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s remaining`;
}