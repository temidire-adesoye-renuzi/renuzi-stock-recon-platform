import React, { useEffect, useState } from 'react';
import { AlarmClockIcon } from 'lucide-react';
import { formatDuration } from '../../utils/format';

interface CountdownChipProps {
  /** Seconds remaining until the 6:00 PM submission lock. */
  initialSeconds: number;
}

export function CountdownChip({ initialSeconds }: CountdownChipProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const urgent = seconds < 30 * 60;

  return (
    <div
      role="timer"
      aria-live="off"
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ease-out ${
      urgent ?
      'border-danger-25 bg-danger-10 text-[#C22F30]' :
      'border-warn-25 bg-warn-10 text-[#9A6A28]'}`
      }>
      
      <AlarmClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Locks at 6:00 PM</span>
      <span className="h-3 w-px bg-current opacity-30" aria-hidden="true" />
      <span className="num tabular-nums font-semibold">{formatDuration(seconds)}</span>
    </div>);

}