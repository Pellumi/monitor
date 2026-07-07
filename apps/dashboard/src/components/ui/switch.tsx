'use client';

import React from 'react';
import { cn } from './utils';

// ─────────────────────────────────────────────────────────────────────────────
// Switch (binary toggle)
// ─────────────────────────────────────────────────────────────────────────────

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Labels shown on either side of the toggle */
  labels?: [string, string];
}

export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  className,
  labels,
}: SwitchProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      {labels && (
        <span
          className={cn(
            'text-xs font-medium transition-colors cursor-pointer select-none',
            !checked ? 'text-white' : 'text-neutral-500',
          )}
          onClick={() => !disabled && onCheckedChange(false)}
        >
          {labels[0]}
        </span>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-indigo-600' : 'bg-neutral-700',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      {labels && (
        <span
          className={cn(
            'text-xs font-medium transition-colors cursor-pointer select-none',
            checked ? 'text-white' : 'text-neutral-500',
          )}
          onClick={() => !disabled && onCheckedChange(true)}
        >
          {labels[1]}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SegmentedControl (for 3+ options)
// ─────────────────────────────────────────────────────────────────────────────

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  id,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      id={id}
      className={cn(
        'inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            value === opt.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
            disabled && 'cursor-not-allowed',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
