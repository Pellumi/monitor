'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/switch';
import type { SessionFilters, UseSessionFilters } from '@/hooks/use-session-filters';

/**
 * The filters that make a reported session findable.
 *
 * Arranged by how a support conversation actually goes: a reader arrives knowing *who*
 * complained, or *what* broke, and rarely a session id. So identity and free text come
 * first and the narrowing controls follow, with the rest behind a disclosure so the
 * common case is one row.
 */

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet', 'bot', 'unknown'];

interface SessionFilterBarProps {
  controller: UseSessionFilters;
  /** Values observed in this application, so the lists offer only what exists. */
  facets?: { browsers: string[]; releases: string[]; states: string[] };
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

function TextFilter({
  label, value, placeholder, onChange, width = 'w-44',
}: {
  label: string; value: string; placeholder: string; onChange: (value: string) => void; width?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${width} rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none`}
      />
    </label>
  );
}

function MultiSelect({
  label, options, selected, onToggle, placeholder,
}: {
  label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; placeholder: string;
}) {
  if (options.length === 0) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</span>
      <Select value="" onValueChange={onToggle} width="12rem">
        <SelectTrigger>
          {/* The count rather than the values: three browser names do not fit, and a
              truncated list is less useful than a number the reader can expand. */}
          <SelectValue placeholder={selected.length > 0 ? `${selected.length} selected` : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-3 w-3 shrink-0 rounded-sm border ${
                    selected.includes(option)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-neutral-700 bg-transparent'
                  }`}
                />
                {option}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function SessionFilterBar({ controller, facets, expanded, onExpandedChange }: SessionFilterBarProps) {
  const { filters, setFilter, toggleValue, clear, activeCount } = controller;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextFilter
          label="Search"
          value={filters.q}
          placeholder="error, state, route…"
          onChange={(value) => setFilter('q', value)}
          width="w-56"
        />
        <TextFilter
          label="User"
          value={filters.endUser}
          placeholder="user id or email"
          onChange={(value) => setFilter('endUser', value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">Errors</span>
          <SegmentedControl
            value={filters.errors}
            onChange={(value) => setFilter('errors', value)}
            options={[
              { value: '', label: 'Any' },
              { value: 'with', label: 'With' },
              { value: 'without', label: 'Without' },
            ]}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">Outcome</span>
          <SegmentedControl
            value={filters.outcome}
            onChange={(value) => setFilter('outcome', value)}
            options={[
              { value: '', label: 'Any' },
              { value: 'abandoned', label: 'Abandoned' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear {activeCount}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onExpandedChange(!expanded)}>
            {expanded ? 'Fewer filters' : 'More filters'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-neutral-800 pt-4">
          <TextFilter
            label="Error contains"
            value={filters.errorContains}
            placeholder="ECONNRESET"
            onChange={(value) => setFilter('errorContains', value)}
          />
          <MultiSelect
            label="Device"
            options={DEVICE_TYPES}
            selected={filters.deviceType}
            onToggle={(value) => toggleValue('deviceType', value)}
            placeholder="Any device"
          />
          <MultiSelect
            label="Browser"
            options={facets?.browsers ?? []}
            selected={filters.browserName}
            onToggle={(value) => toggleValue('browserName', value)}
            placeholder="Any browser"
          />
          <MultiSelect
            label="Release"
            options={facets?.releases ?? []}
            selected={filters.releaseVersion}
            onToggle={(value) => toggleValue('releaseVersion', value)}
            placeholder="Any release"
          />
          <MultiSelect
            label="State touched"
            options={facets?.states ?? []}
            selected={filters.stateName}
            onToggle={(value) => toggleValue('stateName', value)}
            placeholder="Any state"
          />

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">API status</span>
            <Select value={filters.statusClass} onValueChange={(value) => setFilter('statusClass', value)} width="9rem">
              <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any status</SelectItem>
                <SelectItem value="4xx">4xx seen</SelectItem>
                <SelectItem value="5xx">5xx seen</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <TextFilter
            label="Min duration (s)"
            value={filters.minDurationMs ? String(Number(filters.minDurationMs) / 1000) : ''}
            placeholder="0"
            onChange={(value) => setFilter('minDurationMs', value ? String(Math.round(Number(value) * 1000)) : '')}
            width="w-28"
          />
          <TextFilter
            label="Anonymous id"
            value={filters.anonymousId}
            placeholder="browser id"
            onChange={(value) => setFilter('anonymousId', value)}
          />
        </div>
      )}
    </div>
  );
}
