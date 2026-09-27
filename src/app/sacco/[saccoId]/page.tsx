'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import type { Filter } from 'nostr-tools/filter'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']
const APP_PUBKEY = process.env.NEXT_PUBLIC_NOSTR_APP_PUBKEY!

export default function SaccoPage({ params }: { params: { saccoId: string } }) {
  const [totalKes, setTotalKes] = useState(0)
  const [byVehicle, setByVehicle] = useState<Record<string, number>>({})

  useEffect(() => {
    const pool = new SimplePool()
    const seen = new Set<string>()

    const filter: Filter = {
      kinds: [1],
      authors: [APP_PUBKEY],
      '#sacco': [params.saccoId],
      since: Math.floor(Date.now() / 1000) - 86400,
    }

    const sub = pool.subscribeMany(
      RELAYS,
      filter,
      {
        onevent(event) {
          if (seen.has(event.id)) return // relays can send duplicates
          seen.add(event.id)
          try {
            const { amount_kes, vehicle } = JSON.parse(event.content)
            setTotalKes((t) => t + amount_kes)
            setByVehicle((prev) => ({ ...prev, [vehicle]: (prev[vehicle] ?? 0) + amount_kes }))
          } catch {
            // ignore malformed events
          }
        },
      }
    )

    return () => {
      sub.close()
      pool.close(RELAYS)
    }
  }, [params.saccoId])

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-xl text-gray-500 mb-2">Today's mobile-money fares</h1>
      <div className="text-6xl font-extrabold mb-8">KES {totalKes.toLocaleString()}</div>

      <h2 className="text-lg font-semibold text-gray-500 mb-3">By vehicle</h2>
      <div className="space-y-2">
        {Object.entries(byVehicle).map(([code, amt]) => (
          <div key={code} className="flex justify-between text-2xl bg-white rounded-xl p-4 border border-gray-200">
            <span className="font-bold">{code}</span>
            <span>KES {amt.toLocaleString()}</span>
          </div>
        ))}
        {Object.keys(byVehicle).length === 0 && <p className="text-gray-400 text-lg">Waiting for fares…</p>}
      </div>

      <p className="text-sm text-gray-400 mt-8">Live via Nostr — relays: {RELAYS.join(', ')}</p>
    </main>
  )
}
