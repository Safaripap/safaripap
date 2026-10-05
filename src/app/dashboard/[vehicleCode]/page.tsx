'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { alertFarePaid, enableFareAlerts, fareAlertsEnabled } from '@/lib/fare-alerts'
import { primeSpeech, speak, spellOut } from '@/lib/speech'
import { AppHeader } from '@/components/AppHeader'
import { ConductorNav } from '@/components/ConductorNav'
import { FareTable } from '@/components/FareTable'
import {
  DEFAULT_VIEW,
  dayOptions,
  fetchFarePage,
  formatWhen,
  isLiveHead,
  normalizeQuery,
  PAGE_SIZE,
  SERVER_SEARCH_MIN,
  SORT_OPTIONS,
  sortFares,
  statusOf,
  type FareSort,
  type FareView,
  type Tone,
  type Txn,
} from '@/lib/fares'

type LoadState = 'loading' | 'notFound' | 'ready'

const SELECT_CLASSES =
  'w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-3 text-lg text-brand-dark focus:border-brand outline-none'

export default function DashboardPage({ params }: { params: { vehicleCode: string } }) {
  const [vehicleId, setVehicleId] = useState<string | null>(null)
  const [rows, setRows] = useState<Txn[]>([])
  const [total, setTotal] = useState(0)
  const [hasAnyFares, setHasAnyFares] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [alertsOn, setAlertsOn] = useState(false)
  const [connected, setConnected] = useState(false)
  // Rows that just arrived, flashed with a tint of their status colour. The
  // class is removed a frame later and the background transitions back.
  const [fresh, setFresh] = useState<Record<string, Tone>>({})
  const [announcement, setAnnouncement] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<FareSort>(DEFAULT_VIEW.sort)
  const [day, setDay] = useState(DEFAULT_VIEW.day)
  const [page, setPage] = useState(0)
  // New fares that arrived while the conductor was looking at another page,
  // sort or day — offered as a "show latest" button instead of jumping.
  const [newWhileAway, setNewWhileAway] = useState(0)
  const [serverResults, setServerResults] = useState<Txn[] | null>(null)
  const [searchError, setSearchError] = useState('')
  const [fetchError, setFetchError] = useState('')
  // Fares we've already announced, so a paid fare only alerts once even if
  // Realtime sends more updates for it.
  const announcedIds = useRef(new Set<string>())
  const listTopRef = useRef<HTMLDivElement>(null)
  const code = params.vehicleCode.toUpperCase()

  const q = normalizeQuery(query)
  const receiptSearch = q.length >= SERVER_SEARCH_MIN
  const view: FareView = { sort, day, page, q: receiptSearch ? '' : q }
  // The realtime handler is registered once, so it reads the view from a ref.
  const viewRef = useRef(view)
  viewRef.current = view
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  function flash(id: string, tone: Tone) {
    setFresh((prev) => ({ ...prev, [id]: tone === 'neutral' ? 'wait' : tone }))
    // Two frames so the tint paints before it starts fading.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setFresh((prev) => {
          const { [id]: _, ...rest } = prev
          return rest
        })
      )
    )
  }

  // Vehicle lookup + realtime subscription, once per vehicle.
  useEffect(() => {
    let channel: ReturnType<typeof supabaseBrowser.channel>

    ;(async () => {
      const { data: vehicle } = await supabaseBrowser
        .from('vehicles')
        .select('id')
        .eq('vehicle_code', code)
        .single()
      if (!vehicle) {
        setLoadState('notFound')
        return
      }
      setVehicleId(vehicle.id)

      // React Strict Mode runs this effect twice in dev. If a channel with this
      // name is already subscribed from the previous run, remove it first —
      // Supabase reuses channels by name and throws if you .on() one that's
      // already subscribed.
      const channelName = `txns-${vehicle.id}`
      const existing = supabaseBrowser.getChannels().find((c) => c.topic === `realtime:${channelName}`)
      if (existing) supabaseBrowser.removeChannel(existing)

      channel = supabaseBrowser
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions', filter: `vehicle_id=eq.${vehicle.id}` },
          (payload) => {
            const row = payload.new as Txn
            setHasAnyFares(true)
            if (rowsRef.current.some((r) => r.id === row.id)) {
              setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)))
            } else if (payload.eventType === 'INSERT') {
              if (isLiveHead(viewRef.current)) {
                setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)].slice(0, PAGE_SIZE))
                setTotal((t) => t + 1)
              } else {
                setNewWhileAway((n) => n + 1)
              }
            }
            setServerResults(
              (prev) => prev && prev.map((r) => (r.id === row.id ? { ...row, mpesa_receipt: r.mpesa_receipt } : r))
            )
            flash(row.id, statusOf(row).tone)
            // A row is inserted when the passenger starts paying, and only
            // becomes 'fulfilled' once the money has actually arrived. A later
            // update that marks it verified is not a new payment.
            if (row.status === 'fulfilled' && !row.verified_by_conductor && !announcedIds.current.has(row.id)) {
              announcedIds.current.add(row.id)
              alertFarePaid(row.amount_kes)
              // Digits spelled out so they're read "6 7 8", not "six hundred seventy-eight".
              setAnnouncement(`New payment. KES ${row.amount_kes}. Phone ending ${spellOut(row.phone_last3)}.`)
              // Spoken aloud too once alerts are on (that tap unlocked speech).
              if (fareAlertsEnabled()) speak(`Paid ${row.amount_kes} shillings. Phone ending ${spellOut(row.phone_last3)}.`)
              setToast(`Paid: KES ${row.amount_kes}`)
              setTimeout(() => setToast(null), 4000)
            }
          }
        )
        .subscribe((status) => setConnected(status === 'SUBSCRIBED'))
    })()

    return () => {
      if (channel) supabaseBrowser.removeChannel(channel)
    }
  }, [code])

  // One page for the current sort, day and ending search.
  const loadPage = useCallback(async () => {
    if (!vehicleId) return
    setBusy(true)
    const { rows: pageRows, total: count, error } = await fetchFarePage(supabaseBrowser, vehicleId, viewRef.current)
    setBusy(false)
    if (error) {
      setFetchError("Couldn't load fares. Check your connection and try again.")
      setLoadState('ready')
      return
    }
    setFetchError('')
    setRows(pageRows)
    setTotal(count)
    if (count > 0) setHasAnyFares(true)
    for (const r of pageRows) if (r.status === 'fulfilled') announcedIds.current.add(r.id)
    setLoadState('ready')
  }, [vehicleId])

  useEffect(() => {
    if (!receiptSearch) loadPage()
  }, [loadPage, sort, day, page, view.q, receiptSearch])

  // Full-receipt search: 4+ characters go to the server, which is the only
  // place the full receipt lives.
  useEffect(() => {
    setSearchError('')
    if (!receiptSearch) {
      setServerResults(null)
      return
    }
    // Wait for a pause in typing before asking the server.
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession()
        const res = await fetch(`/api/dashboard/search?vehicle=${encodeURIComponent(code)}&q=${q}`, {
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error)
        setServerResults(body.results)
      } catch (err: any) {
        if (err.name === 'AbortError') return
        setServerResults([])
        setSearchError("Couldn't search right now. Check your connection and try again.")
      }
    }, 250)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [q, code, receiptSearch])

  const visibleRows = receiptSearch ? sortFares(serverResults ?? [], sort) : rows
  const searchPending = receiptSearch && serverResults === null && !searchError
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = !!q || day !== 'all'

  function goToPage(next: number) {
    setPage(next)
    listTopRef.current?.scrollIntoView({ block: 'start' })
  }

  function showLatest() {
    const alreadyThere = isLiveHead(viewRef.current)
    setQuery('')
    setSort('newest')
    setDay('all')
    setPage(0)
    setNewWhileAway(0)
    // Already on the defaults: nothing above changes, so fetch explicitly.
    if (alreadyThere) loadPage()
  }

  async function turnOnAlerts() {
    primeSpeech('Payment alerts are on.') // inside the tap, so later fares can be spoken
    await enableFareAlerts()
    setAlertsOn(fareAlertsEnabled())
  }

  async function verify(id: string) {
    const fare = visibleRows.find((r) => r.id === id)
    if (fare) setAnnouncement(`Verified. Phone ending ${spellOut(fare.phone_last3)}.`)
    await supabaseBrowser
      .from('transactions')
      .update({ verified_by_conductor: true, verified_at: new Date().toISOString() })
      .eq('id', id)
  }

  const resultSummary = searchPending
    ? 'Searching receipts…'
    : searchError ||
      (receiptSearch
        ? visibleRows.length === 0
          ? /^\d+$/.test(q)
            ? 'No receipt matches. Phones are searched by their last 3 digits only.'
            : `No receipt ends in ${q}.`
          : `${visibleRows.length} ${visibleRows.length === 1 ? 'match' : 'matches'}`
        : total === 0
        ? q
          ? `No fares match ${q}.`
          : 'No fares on this day.'
        : `${total} ${total === 1 ? 'fare' : 'fares'}`)

  return (
    <main className="min-h-screen p-4 pb-32">
      <AppHeader plate={code} alerts back={{ href: '/', label: 'Home' }} />

      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-display-sm">Fares</h1>
        <span
          className={`inline-flex items-center gap-2 text-sm font-medium ${
            connected ? 'text-route' : 'text-brand-dark/60'
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-2 h-2 rounded-full ${connected ? 'bg-route' : 'bg-brand-dark/30'}`}
          />
          {connected ? 'live' : 'connecting…'}
        </span>
      </div>

      {/* Read out new fares for conductors using TalkBack/VoiceOver. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {loadState === 'ready' && !alertsOn && (
        <button
          onClick={turnOnAlerts}
          className="w-full bg-brand text-white text-xl font-bold rounded-xl py-3 mb-4"
        >
          Turn on payment alerts
        </button>
      )}

      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-route text-white text-xl font-semibold rounded-xl p-4 text-center z-10 shadow-lg">
          {toast}
        </div>
      )}

      {loadState === 'loading' && (
        <div className="text-center py-16">
          <div aria-hidden="true" className="w-10 h-10 border-4 border-brand-dark/20 border-t-brand-dark rounded-full mx-auto mb-4 animate-spin" />
          <p role="status" className="text-brand-dark/60">Connecting to {code}…</p>
        </div>
      )}

      {loadState === 'notFound' && (
        <div className="text-center py-16 max-w-sm mx-auto">
          <p className="text-lg text-brand-dark/60">
            No vehicle registered as {code}. Double-check the code this dashboard link was sent for.
          </p>
        </div>
      )}

      {loadState === 'ready' && !hasAnyFares && !filtered && (
        <div className="text-center py-16">
          <p className="text-brand-dark/60 text-lg">No fares yet — this updates the moment a passenger pays.</p>
        </div>
      )}

      {loadState === 'ready' && (hasAnyFares || filtered) && (
        <div className="mb-4 space-y-2">
          <label htmlFor="fare-search" className="sr-only">
            Search fares by phone or receipt ending
          </label>
          <div className="flex gap-2">
            <input
              id="fare-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Phone or receipt ending"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex-1 min-w-0 min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-xl tabular-nums placeholder:text-brand-dark/60 focus:border-brand outline-none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setPage(0)
                }}
                className="px-4 rounded-xl border-2 border-brand-dark/15 bg-white text-lg font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="fare-sort" className="block text-sm font-medium text-brand-dark/70 mb-1">
                Sort
              </label>
              <select
                id="fare-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as FareSort)
                  setPage(0)
                }}
                className={SELECT_CLASSES}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fare-day" className="block text-sm font-medium text-brand-dark/70 mb-1">
                Day
              </label>
              <select
                id="fare-day"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value)
                  setPage(0)
                }}
                disabled={receiptSearch}
                className={`${SELECT_CLASSES} disabled:opacity-50`}
              >
                {dayOptions().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p role="status" className="text-base text-brand-dark/70">
            {fetchError || resultSummary}
          </p>
        </div>
      )}

      {newWhileAway > 0 && (
        <button
          onClick={showLatest}
          className="w-full mb-4 rounded-xl border-2 border-route bg-route-light text-route text-lg font-semibold px-4"
        >
          {newWhileAway} new {newWhileAway === 1 ? 'fare' : 'fares'} — show latest
        </button>
      )}

      <div ref={listTopRef} className="scroll-mt-4" />

      {loadState === 'ready' && visibleRows.length > 0 && (
        <>
          <FareTable
            rows={visibleRows}
            query={receiptSearch ? '' : q}
            fullReceiptQuery={q}
            fresh={fresh}
            busy={busy}
            onVerify={verify}
          />

          {!receiptSearch && pageCount > 1 && (
            <nav aria-label="Fare pages" className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0 || busy}
                className="px-4 rounded-xl border-2 border-brand-dark/15 bg-white text-lg font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-base tabular-nums text-brand-dark/70 text-center">
                Page {page + 1} of {pageCount}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount - 1 || busy}
                className="px-4 rounded-xl border-2 border-brand-dark/15 bg-white text-lg font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      <ConductorNav active="fares" vehicleCode={code} />
    </main>
  )
}
