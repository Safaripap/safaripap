// Pure helpers for the conductor dashboard's fare list, kept out of the page
// so they can be unit-tested.

export interface Txn {
  id: string
  amount_kes: number
  phone_last3: string
  receipt_last3: string
  status: string
  verified_by_conductor: boolean
  created_at: string
  // Only present on rows returned by a full-receipt search.
  mpesa_receipt?: string | null
}

export type Tone = 'route' | 'wait' | 'neutral'

// 12-hour clock, lowercase am/pm: "2:14 pm".
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

export function statusOf(r: Txn): { label: string; tone: Tone } {
  if (r.verified_by_conductor) return { label: 'Verified', tone: 'route' }
  if (r.status === 'fulfilled') return { label: 'Paid — tap to verify', tone: 'wait' }
  if (r.status === 'failed') return { label: 'Failed', tone: 'neutral' }
  return { label: 'Waiting…', tone: 'neutral' }
}

// Search input → uppercase letters and digits only, so "9f3 " matches "9F3".
export const normalizeQuery = (q: string) => q.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Endings (3 characters or fewer) are matched in the browser against what the
// dashboard already holds. Anything longer can only be a receipt, and goes to
// the server, which is the only place the full receipt lives.
export const SERVER_SEARCH_MIN = 4

// Which rows to show for a (normalized) query: everything, endings matched
// locally, or the server's matches with live status from the realtime list
// where we have it.
export function visibleFares(rows: Txn[], q: string, serverResults: Txn[] | null): Txn[] {
  if (!q) return rows
  if (q.length < SERVER_SEARCH_MIN) {
    return rows.filter((r) => r.phone_last3.includes(q) || r.receipt_last3.toUpperCase().includes(q))
  }
  return (serverResults ?? []).map((m) => ({ ...(rows.find((r) => r.id === m.id) ?? m), mpesa_receipt: m.mpesa_receipt }))
}
