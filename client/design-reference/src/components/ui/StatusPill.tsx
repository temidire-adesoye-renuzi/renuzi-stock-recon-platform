import React from 'react';
import { AlertTriangleIcon, CheckIcon, SearchIcon } from 'lucide-react';
import type { RowStatus } from '../../types/recon';

const config: Record<RowStatus, {label: string;className: string;Icon: typeof CheckIcon;}> = {
  matched: {
    label: 'Matched',
    className: 'bg-success-10 text-[#00753A] border-success-25',
    Icon: CheckIcon
  },
  discrepancy: {
    label: 'Discrepancy',
    className: 'bg-danger-10 text-[#C22F30] border-danger-25',
    Icon: AlertTriangleIcon
  },
  review: {
    label: 'Needs Review',
    className: 'bg-warn-10 text-[#9A6A28] border-warn-25',
    Icon: SearchIcon
  }
};

export function StatusPill({ status }: {status: RowStatus;}) {
  const { label, className, Icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium ${className}`}>
      
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>);

}