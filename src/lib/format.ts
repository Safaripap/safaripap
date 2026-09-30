// Display formatting shared by the manager dashboard.

export const formatKes = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`

// Axis ticks: 0, 500, 1.5K, 12K, 1.2M
export function compactKes(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return String(n)
}

// '2026-10-05' → 'Mon 5 Oct' (the day is a Nairobi calendar day; format it as
// a plain date so the viewer's own timezone can't shift it).
export function formatDay(day: string, opts: { weekday?: boolean } = { weekday: true }): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    ...(opts.weekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  })
}

export function formatRange(from: string, to: string): string {
  return from === to ? formatDay(from) : `${formatDay(from, { weekday: false })} – ${formatDay(to, { weekday: false })}`
}

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`
