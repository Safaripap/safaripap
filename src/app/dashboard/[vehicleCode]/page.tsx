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

export default function DashboardPage({ params }: { params: { vehicleCode: string } }) {
  const [rows, setRows] = useState<Txn[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [alertsOn, setAlertsOn] = useState(false)
  // Fares we've already announced, so a paid fare only alerts once even if
  // Realtime sends more updates for it (e.g. when it's verified).
  const announcedIds = useRef(new Set<string>())
  const router = useRouter()
  const code = params.vehicleCode.toUpperCase()

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
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(50)
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
            // A row is inserted when the passenger starts paying, and only
            // becomes 'fulfilled' once the money has actually arrived.
            if (row.status === 'fulfilled' && !announcedIds.current.has(row.id)) {
              announcedIds.current.add(row.id)
              alertFarePaid(row.amount_kes)
              setToast(`Paid: KES ${row.amount_kes}`)
              setTimeout(() => setToast(null), 4000)
            }
          }
        )
        .subscribe()
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

  const statusLabel = (r: Txn) =>
    r.verified_by_conductor ? 'Verified' : r.status === 'fulfilled' ? 'Paid — tap to verify' : 'Waiting…'

  return (
    <main className="min-h-screen p-4 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="route-plate">{code}</span>
        <span className="text-sm text-brand-dark/50">live fares</span>
      </div>

      {loadState === 'ready' && !alertsOn && (
        <button
          onClick={turnOnAlerts}
          className="w-full bg-brand text-white text-xl font-bold rounded-xl py-3 mb-4"
        >
          🔔 Turn on payment alerts
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
          <p className="text-brand-dark/50">Connecting to {code}…</p>
        </div>
      )}

      {loadState === 'notFound' && (
        <div className="text-center py-16 max-w-sm mx-auto">
          <p className="text-lg text-brand-dark/60">
            No vehicle registered as {code}. Double-check the code this dashboard link was sent for.
          </p>
        </div>
      )}

      {loadState === 'ready' && (
        <div className="space-y-2">
          {rows.length === 0 && (
            <div className="text-center py-16">
              <p className="text-brand-dark/40 text-lg">No fares yet — this updates the moment a passenger pays.</p>
            </div>
          )}
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => !r.verified_by_conductor && r.status === 'fulfilled' && verify(r.id)}
              className={`w-full text-left p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${
                r.verified_by_conductor
                  ? 'bg-route-light border-route/40'
                  : r.status === 'fulfilled'
                  ? 'bg-wait-light border-wait/40'
                  : 'bg-white border-brand-dark/10'
              }`}
            >
              <span className="font-display text-3xl">KES {r.amount_kes}</span>
              <span className="text-lg text-brand-dark/50 hidden sm:inline">…{r.phone_last3} / …{r.receipt_last3}</span>
              <span className="text-lg font-semibold text-right">{statusLabel(r)}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}