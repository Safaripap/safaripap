'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [notFound, setNotFound] = useState(false)
  // Fares we've already announced, so a paid fare only alerts once even if
  // Realtime sends more updates for it (e.g. when it's verified).
  const announcedIds = useRef(new Set<string>())
  const router = useRouter()

  useEffect(() => {
    let vehicleId: string
    let channel: ReturnType<typeof supabaseBrowser.channel>

    ;(async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      // RLS only returns the vehicle linked to the signed-in conductor, so
      // someone else's vehicle code comes back empty.
      const { data: vehicle } = await supabaseBrowser
        .from('vehicles')
        .select('id')
        .eq('vehicle_code', params.vehicleCode.toUpperCase())
        .single()
      if (!vehicle) {
        setNotFound(true)
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
  }, [params.vehicleCode, router])

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
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{params.vehicleCode.toUpperCase()} — live fares</h1>
        <button onClick={signOut} className="text-lg text-gray-500 underline">
          Sign out
        </button>
      </div>

      {notFound && <p className="text-red-600 text-lg mb-4">This vehicle isn't linked to your account.</p>}

      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-green-500 text-white text-xl font-bold rounded-xl p-4 text-center z-10 shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-[2fr_1.2fr_1.6fr] gap-2 px-4 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <span>Paid by</span>
        <span className="text-center">Fare</span>
        <span className="text-right">Status</span>
      </div>

      <div className="space-y-2">
        {!notFound && rows.length === 0 && <p className="text-gray-400 text-lg">No fares yet.</p>}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => !r.verified_by_conductor && r.status === 'fulfilled' && verify(r.id)}
            className={`w-full text-left p-4 rounded-xl border-2 grid grid-cols-[2fr_1.2fr_1.6fr] gap-2 items-center ${
              r.verified_by_conductor
                ? 'bg-green-50 border-green-300'
                : r.status === 'fulfilled'
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-white border-gray-200'
            }`}
          >
            <span className="text-xl text-gray-600">…{r.phone_last3} / …{r.receipt_last3}</span>
            <span className="text-4xl font-extrabold text-center">KES {r.amount_kes}</span>
            <span className="text-xl font-semibold text-right">{statusLabel(r)}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
