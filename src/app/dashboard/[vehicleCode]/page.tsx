'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { alertFarePaid, enableFareAlerts, fareAlertsEnabled } from '@/lib/fare-alerts'

interface Txn {
  id: string
  amount_kes: number
  phone_last3: string
  receipt_last3: string
  status: string
  verified_by_conductor: boolean
  created_at: string
}

type LoadState = 'loading' | 'notFound' | 'ready'
type Tone = 'route' | 'wait' | 'neutral'

// Only the short endings reach the browser — never payer_phone.
const TXN_COLUMNS = 'id, amount_kes, phone_last3, receipt_last3, status, verified_by_conductor, created_at'

// 12-hour clock, lowercase am/pm: "2:14 pm".
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

function statusOf(r: Txn): { label: string; tone: Tone } {
  if (r.verified_by_conductor) return { label: 'Verified', tone: 'route' }
  if (r.status === 'fulfilled') return { label: 'Paid — tap to verify', tone: 'wait' }
  if (r.status === 'failed') return { label: 'Failed', tone: 'neutral' }
  return { label: 'Waiting…', tone: 'neutral' }
}

const PILL_CLASSES: Record<Tone, string> = {
  route: 'bg-route-light text-route',
  wait: 'bg-wait-light text-wait-ink',
  neutral: 'bg-brand-dark/5 text-brand-dark/70',
}

export default function DashboardPage({ params }: { params: { vehicleCode: string } }) {
  const [rows, setRows] = useState<Txn[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [alertsOn, setAlertsOn] = useState(false)
  const [connected, setConnected] = useState(false)
  // Rows that just arrived, flashed with a tint of their status colour. The
  // class is removed a frame later and the background transitions back.
  const [fresh, setFresh] = useState<Record<string, Tone>>({})
  const [announcement, setAnnouncement] = useState('')
  // Fares we've already announced, so a paid fare only alerts once even if
  // Realtime sends more updates for it (e.g. when it's verified).
  const announcedIds = useRef(new Set<string>())
  const router = useRouter()
  const code = params.vehicleCode.toUpperCase()

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

  useEffect(() => {
    let vehicleId: string
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
      vehicleId = vehicle.id

      const { data: initial } = await supabaseBrowser
        .from('transactions')
        .select(TXN_COLUMNS)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<Txn[]>()
      setRows(initial ?? [])
      for (const r of initial ?? []) if (r.status === 'fulfilled') announcedIds.current.add(r.id)
      setLoadState('ready')

      // React Strict Mode runs this effect twice in dev. If a channel with this
      // name is already subscribed from the previous run, remove it first —
      // Supabase reuses channels by name and throws if you .on() one that's
      // already subscribed.
      const channelName = `txns-${vehicleId}`
      const existing = supabaseBrowser.getChannels().find((c) => c.topic === `realtime:${channelName}`)
      if (existing) supabaseBrowser.removeChannel(existing)

      channel = supabaseBrowser
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions', filter: `vehicle_id=eq.${vehicleId}` },
          (payload) => {
            const row = payload.new as Txn
            setRows((prev) => {
              const rest = prev.filter((r) => r.id !== row.id)
              return [row, ...rest]
            })
            flash(row.id, statusOf(row).tone)
            // A row is inserted when the passenger starts paying, and only
            // becomes 'fulfilled' once the money has actually arrived.
            if (row.status === 'fulfilled' && !announcedIds.current.has(row.id)) {
              announcedIds.current.add(row.id)
              alertFarePaid(row.amount_kes)
              setAnnouncement(`New payment, KES ${row.amount_kes}, ending ${row.phone_last3}`)
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
  }, [code, router])

  async function turnOnAlerts() {
    await enableFareAlerts()
    setAlertsOn(fareAlertsEnabled())
  }

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.replace('/login')
  }

  async function verify(id: string) {
    await supabaseBrowser
      .from('transactions')
      .update({ verified_by_conductor: true, verified_at: new Date().toISOString() })
      .eq('id', id)
  }

  return (
    <main className="min-h-screen p-4 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="route-plate">{code}</span>
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
          <div className="w-10 h-10 border-4 border-brand-dark/20 border-t-brand-dark rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-brand-dark/60">Connecting to {code}…</p>
        </div>
      )}

      {loadState === 'notFound' && (
        <div className="text-center py-16 max-w-sm mx-auto">
          <p className="text-lg text-brand-dark/60">
            No vehicle registered as {code}. Double-check the code this dashboard link was sent for.
          </p>
        </div>
      )}

      {loadState === 'ready' && rows.length === 0 && (
        <div className="text-center py-16">
          <p className="text-brand-dark/60 text-lg">No fares yet — this updates the moment a passenger pays.</p>
        </div>
      )}

      {loadState === 'ready' && rows.length > 0 && (
        <>
          <div
            aria-hidden="true"
            className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_6rem_12rem] gap-x-4 px-4 pb-2 text-sm text-brand-dark/60"
          >
            <span>Phone / receipt</span>
            <span>Fare</span>
            <span>Time</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="space-y-2">
            {rows.map((r) => {
              const status = statusOf(r)
              const canVerify = !r.verified_by_conductor && r.status === 'fulfilled'
              const receipt = r.receipt_last3
              const tint = fresh[r.id]
              const rowClass = `motion-row-highlight w-full text-left p-4 rounded-xl bg-white border-2 border-brand-dark/10 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7rem_6rem_12rem] gap-x-4 gap-y-1 items-center ${
                tint ? `is-new-${tint}` : ''
              }`
              const cells = (
                <>
                  <span className="font-display text-3xl font-bold tabular-nums text-brand-dark break-words">
                    <span className="sr-only">Phone ending </span>
                    {r.phone_last3}
                    <span aria-hidden="true" className="mx-2 text-brand-dark/30">/</span>
                    <span className="sr-only">, receipt ending </span>
                    {receipt || <span className="text-brand-dark/30" aria-label="pending">—</span>}
                  </span>
                  <span className="col-start-1 flex flex-wrap gap-x-3 sm:contents">
                    <span className="font-body font-semibold text-lg text-brand-dark">KES {r.amount_kes}</span>
                    <span className="text-lg tabular-nums text-brand-dark/70">{formatTime(r.created_at)}</span>
                  </span>
                  <span className="col-start-2 row-start-1 row-span-2 sm:col-start-4 sm:row-span-1 justify-self-end">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-base font-semibold text-center ${PILL_CLASSES[status.tone]}`}
                    >
                      {status.label}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={r.id}>
                  {canVerify ? (
                    <button onClick={() => verify(r.id)} className={rowClass}>
                      {cells}
                    </button>
                  ) : (
                    <div className={rowClass}>{cells}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}
