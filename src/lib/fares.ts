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

// Only the short endings reach the browser — never payer_phone.
export const TXN_COLUMNS = 'id, amount_kes, phone_last3, receipt_last3, status, verified_by_conductor, created_at'

export const PAGE_SIZE = 20

export type FareSort = 'newest' | 'oldest' | 'fare_desc' | 'fare_asc'

export const SORT_OPTIONS: { value: FareSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'fare_desc', label: 'Highest fare' },
  { value: 'fare_asc', label: 'Lowest fare' },
]

// 'all' or a local calendar day as YYYY-MM-DD.
export type FareDay = string

const pad = (n: number) => String(n).padStart(2, '0')
// Spelled out rather than toLocaleDateString: engines disagree on "Sep" vs "Sept".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// "All days", "Today", "Yesterday", then the five days before that.
export function dayOptions(now = new Date()): { value: FareDay; label: string }[] {
  const options = [{ value: 'all', label: 'All days' }]
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const label =
      i === 0
        ? 'Today'
        : i === 1
        ? 'Yesterday'
        : `${WEEKDAYS[d.getDay()]} ${shortDate(d)}`
    options.push({ value: dayKey(d), label })
  }
  return options
}

// Local midnight to the next local midnight, as ISO timestamps.
export function dayRange(day: FareDay): [string, string] {
  const [y, m, d] = day.split('-').map(Number)
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()]
}

// "2:14 pm" today, "Yesterday, 2:14 pm", otherwise "28 Sep, 2:14 pm" — once
// the list spans days, the time alone is ambiguous.
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = formatTime(iso)
  if (dayKey(d) === dayKey(now)) return time
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (dayKey(d) === dayKey(yesterday)) return `Yesterday, ${time}`
  return `${shortDate(d)}, ${time}`
}

export function sortFares(rows: Txn[], sort: FareSort): Txn[] {
  const byTime = (a: Txn, b: Txn) => a.created_at.localeCompare(b.created_at)
  const copy = [...rows]
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => byTime(b, a))
    case 'oldest':
      return copy.sort(byTime)
    case 'fare_desc':
      return copy.sort((a, b) => b.amount_kes - a.amount_kes || byTime(b, a))
    case 'fare_asc':
      return copy.sort((a, b) => a.amount_kes - b.amount_kes || byTime(b, a))
  }
}

export interface FareView {
  sort: FareSort
  day: FareDay
  page: number // 0-based
  q: string // normalized, endings only (fewer than SERVER_SEARCH_MIN chars)
}

export const DEFAULT_VIEW: FareView = { sort: 'newest', day: 'all', page: 0, q: '' }

// A brand-new fare belongs at the top of what's on screen only when the
// conductor is looking at the live head of the list.
export function isLiveHead(view: FareView, now = new Date()): boolean {
  return view.page === 0 && view.sort === 'newest' && !view.q && (view.day === 'all' || view.day === dayKey(now))
}

// One page of fares for the current sort/day/search, plus the total count.
// Runs as the signed-in conductor, so RLS and the column grants apply.
export async function fetchFarePage(
  client: any,
  vehicleId: string,
  view: FareView
): Promise<{ rows: Txn[]; total: number; error: unknown }> {
  let query = client.from('transactions').select(TXN_COLUMNS, { count: 'exact' }).eq('vehicle_id', vehicleId)
  if (view.day !== 'all') {
    const [start, end] = dayRange(view.day)
    query = query.gte('created_at', start).lt('created_at', end)
  }
  if (view.q) {
    // q is letters/digits only (normalizeQuery), so it's safe inside the filter string.
    query = query.or(`phone_last3.ilike.%${view.q}%,receipt_last3.ilike.%${view.q}%`)
  }
  if (view.sort === 'fare_desc' || view.sort === 'fare_asc') {
    query = query.order('amount_kes', { ascending: view.sort === 'fare_asc' }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: view.sort === 'oldest' })
  }
  const from = view.page * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
  return { rows: (data ?? []) as Txn[], total: count ?? 0, error }
}
