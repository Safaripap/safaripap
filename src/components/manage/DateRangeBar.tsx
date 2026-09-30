'use client'

import { addDays } from '@/lib/insights'

export interface Range {
  from: string
  to: string
}

type PresetId = 'today' | 'yesterday' | '7d' | '30d' | 'month'

export function presetRange(id: PresetId, today: string): Range {
  switch (id) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
]

const CHIP = 'inline-flex min-h-[3.25rem] items-center rounded-xl px-4 text-base font-semibold'

// Date presets first (what most people want), then a custom range.
export function DateRangeBar({ range, today, onChange }: { range: Range; today: string; onChange: (r: Range) => void }) {
  const active = PRESETS.find((p) => {
    const r = presetRange(p.id, today)
    return r.from === range.from && r.to === range.to
  })?.id

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={active === p.id}
            onClick={() => onChange(presetRange(p.id, today))}
            className={`${CHIP} ${active === p.id ? 'bg-brand-dark text-cream' : 'border-2 border-brand-dark/15 bg-white text-brand-dark'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="range-from" className="block text-sm font-semibold text-brand-dark mb-1">
            From
          </label>
          <input
            id="range-from"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && onChange({ from: e.target.value, to: range.to })}
            className="min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-3 text-base tabular-nums focus:border-brand outline-none"
          />
        </div>
        <div>
          <label htmlFor="range-to" className="block text-sm font-semibold text-brand-dark mb-1">
            To
          </label>
          <input
            id="range-to"
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => e.target.value && onChange({ from: range.from, to: e.target.value })}
            className="min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-3 text-base tabular-nums focus:border-brand outline-none"
          />
        </div>
      </div>
    </div>
  )
}
