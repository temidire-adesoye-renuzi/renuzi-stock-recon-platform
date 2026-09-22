import React from 'react';
import { ChevronDownIcon } from 'lucide-react';

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-2xs font-medium text-neutral-500">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 appearance-none rounded-md border border-neutral-300 bg-white py-0 pl-3 pr-8 text-xs font-medium text-ink transition-colors duration-150 ease-out hover:border-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30">
          
          {options.map((option) =>
          <option key={option} value={option}>
              {option}
            </option>
          )}
        </select>
        <ChevronDownIcon
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
          aria-hidden="true" />
        
      </span>
    </label>);

}