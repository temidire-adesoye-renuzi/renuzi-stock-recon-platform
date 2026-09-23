import { AlertTriangleIcon, CheckIcon, SearchIcon } from 'lucide-react'

export type RowStatus = 'Matched' | 'Discrepancy' | 'Unmapped' | 'Needs Review'

const config: Record<RowStatus, { label: string; className: string; Icon: typeof CheckIcon }> = {
  Matched: {
    label: 'Matched',
    className: 'bg-success-10 text-[#00753A] border-success-25',
    Icon: CheckIcon,
  },
  Discrepancy: {
    label: 'Discrepancy',
    className: 'bg-danger-10 text-[#C22F30] border-danger-25',
    Icon: AlertTriangleIcon,
  },
  'Needs Review': {
    label: 'Needs Review',
    className: 'bg-warn-10 text-[#9A6A28] border-warn-25',
    Icon: SearchIcon,
  },
  Unmapped: {
    label: 'Unmapped',
    className: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    Icon: SearchIcon,
  },
}

export function StatusPill({ status }: { status: RowStatus }) {
  const { label, className, Icon } = config[status] ?? config.Unmapped
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
