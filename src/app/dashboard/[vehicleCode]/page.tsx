'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

interface Txn {
  id: string
  amount_kes: number
  phone_last3: string
  receipt_last3: string
  status: string
  verified_by_conductor: boolean
  created_at: string
}

export default function DashboardPage({ params }: { params: { vehicleCode: string } }) {
  const [rows, setRows] = useState<Txn[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let vehicleId: string
    let channel: ReturnType<typeof supabaseBrowser.channel>

    ;(async () => {
      const { data: vehicle } = await supabaseBrowser
        .from('vehicles')
        .select('id')
        .eq('vehicle_code', params.vehicleCode.toUpperCase())
        .single()
      if (!vehicle) return
      vehicleId = vehicle.id

      const { data: initial } = await supabaseBrowser
        .from('transactions')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(50)
      setRows(initial ?? [])

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
            if (payload.eventType === 'INSERT') {
              setToast(`New payment: KES ${row.amount_kes}`)
              setTimeout(() => setToast(null), 4000)
            }
          }
        )
        .subscribe()
    })()

    return () => {
      if (channel) supabaseBrowser.removeChannel(channel)
    }
  }, [params.vehicleCode])

  async function verify(id: string) {
    await supabaseBrowser
      .from('transactions')
      .update({ verified_by_conductor: true, verified_at: new Date().toISOString() })
      .eq('id', id)
  }

  const statusLabel = (r: Txn) =>
    r.verified_by_conductor ? 'Verified' : r.status === 'fulfilled' ? 'Paid — tap to verify' : 'Waiting…'

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">{params.vehicleCode.toUpperCase()} — live fares</h1>

      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-green-500 text-white text-xl font-bold rounded-xl p-4 text-center z-10 shadow-lg">
          {toast}
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-gray-400 text-lg">No fares yet.</p>}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => !r.verified_by_conductor && r.status === 'fulfilled' && verify(r.id)}
            className={`w-full text-left p-4 rounded-xl border-2 flex items-center justify-between ${
              r.verified_by_conductor
                ? 'bg-green-50 border-green-300'
                : r.status === 'fulfilled'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-white border-gray-200'
            }`}
          >
            <span className="text-xl text-gray-600">…{r.phone_last3} / …{r.receipt_last3}</span>
            <span className="text-4xl font-extrabold">KES {r.amount_kes}</span>
            <span className="text-xl font-semibold">{statusLabel(r)}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
