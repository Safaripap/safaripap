'use client'

import { useEffect, useRef, useState } from 'react'
import type { DayTotal } from '@/lib/insights'
import { compactKes, formatDay, formatKes } from '@/lib/format'

const HEIGHT = 220
const PAD = { top: 12, right: 8, bottom: 28, left: 48 }
const BAR_MAX = 24 // bars never fill their slot; the rest is air
const GAP = 2 // surface gap between touching bars

// 0 → a clean top tick above `max`, with 3–4 steps.
function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const ticks = []
  for (let t = 0; t < max + step; t += step) ticks.push(t)
  return ticks
}

// A column with a 4px rounded top, square at the baseline.
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

// Daily fare totals: one series, so no legend (the heading names it). Values
// are also in the table view below, so the tooltip never gates anything.
export function DailyChart({ days, label }: { days: DayTotal[]; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = days.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const ticks = niceTicks(Math.max(0, ...days.map((d) => d.kes)))
  const top = ticks[ticks.length - 1] || 1
  const band = n ? plotW / n : 0
  const barW = Math.max(1, Math.min(BAR_MAX, band - GAP))
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH

  // Label as many days as fit (about 56px each), always the first and last,
  // skipping any that would crowd the last one.
  const maxLabels = Math.max(2, Math.floor(plotW / (n <= 7 ? 44 : 56)))
  const every = Math.max(1, Math.ceil(n / maxLabels))
  const labelled = (i: number) => i === 0 || i === n - 1 || (i % every === 0 && n - 1 - i >= every)
  // Keep the end labels inside the chart instead of centred past its edges.
  const anchor = (i: number) => (n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle')
  const labelX = (i: number) =>
    anchor(i) === 'start' ? PAD.left + band * i : anchor(i) === 'end' ? PAD.left + band * (i + 1) : PAD.left + band * i + band / 2

  const peak = days.reduce<DayTotal | null>((best, d) => (d.kes > (best?.kes ?? 0) ? d : best), null)
  const summary = peak
    ? `${label}. Highest day: ${formatDay(peak.date)}, ${formatKes(peak.kes)}.`
    : `${label}. No fares in this period.`

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - PAD.left
    const i = Math.floor(x / band)
    setHover(i >= 0 && i < n ? i : null)
  }

  const h = hover !== null ? days[hover] : null
  const hx = hover !== null ? PAD.left + band * hover + band / 2 : 0

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={summary}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-brand-dark/10" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-brand-dark/70 text-xs tabular-nums">
                {compactKes(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const bh = PAD.top + plotH - y(d.kes)
            const x = PAD.left + band * i + (band - barW) / 2
            return (
              <g key={d.date}>
                {d.kes > 0 && (
                  <path d={barPath(x, y(d.kes), barW, Math.max(bh, 1))} className={hover === i ? 'fill-brand-dark' : 'fill-brand'} />
                )}
                {labelled(i) && (
                  <text x={labelX(i)} y={HEIGHT - 8} textAnchor={anchor(i)} className="fill-brand-dark/70 text-xs">
                    {formatDay(d.date, { weekday: n <= 7 })}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {h && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-10 rounded-xl bg-white px-3 py-2 shadow-[0_8px_24px_-8px_rgba(26,26,46,0.35)]"
          style={{ left: Math.min(Math.max(hx - 80, 0), Math.max(width - 160, 0)), width: 160 }}
        >
          <p className="font-semibold tabular-nums">{formatKes(h.kes)}</p>
          <p className="text-sm text-brand-dark/70">
            {formatDay(h.date)} · {h.fares} {h.fares === 1 ? 'fare' : 'fares'}
          </p>
        </div>
      )}
    </div>
  )
}
