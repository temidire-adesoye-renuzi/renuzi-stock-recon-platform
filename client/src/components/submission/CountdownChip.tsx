import { useEffect, useState } from 'react'
import { AlarmClockIcon, LockIcon } from 'lucide-react'
import { formatDuration } from '../../lib/format'
import { secondsUntilCutoff } from '../../lib/wat'

/** Live countdown to the 18:00 WAT audit lock; danger under 30 minutes. */
export function CountdownChip() {
  const [seconds, setSeconds] = useState(() => secondsUntilCutoff())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(secondsUntilCutoff())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const locked = seconds <= 0
  const urgent = !locked && seconds < 30 * 60

  if (locked) {
    return (
      <div
        role="timer"
        className="inline-flex items-center gap-2 rounded-md border border-danger-25 bg-danger-10 px-2.5 py-1.5 text-xs font-medium text-[#C22F30]"
      >
        <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Locked for Executive Audit</span>
        <span className="h-3 w-px bg-current opacity-30" aria-hidden="true" />
        <span className="num font-semibold">since 6:00 PM</span>
      </div>
    )
  }

  return (
    <div
      role="timer"
      aria-live="off"
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ease-out ${
        urgent
          ? 'border-danger-25 bg-danger-10 text-[#C22F30]'
          : 'border-warn-25 bg-warn-10 text-[#9A6A28]'
      }`}
    >
      <AlarmClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Locks at 6:00 PM</span>
      <span className="h-3 w-px bg-current opacity-30" aria-hidden="true" />
      <span className="num font-semibold">{formatDuration(seconds)}</span>
    </div>
  )
}
