'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import type { Filter } from 'nostr-tools/filter'
import { ConductorNav } from '@/components/ConductorNav'
import { AppHeader } from '@/components/AppHeader'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']
const APP_PUBKEY = process.env.NEXT_PUBLIC_NOSTR_APP_PUBKEY!

export default function SaccoPage({
  params,
  searchParams,
}: {
  params: { saccoId: string }
  searchParams: { vehicle?: string }
}) {
  const vehicleCode = searchParams.vehicle?.toUpperCase()
  const [totalKes, setTotalKes] = useState(0)
  const [byVehicle, setByVehicle] = useState<Record<string, number>>({})
  const [connected, setConnected] = useState(false)

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
        oneose() {
          setConnected(true)
        },
        onevent(event) {
          setConnected(true)
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
    <main className={`min-h-screen p-6 ${vehicleCode ? 'pb-32' : 'pb-10'}`}>
      <AppHeader plate={vehicleCode} />

      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="text-lg text-brand-dark/70">Today's mobile-money fares</h1>
        <span
          className={`inline-flex items-center gap-2 text-sm font-medium ${connected ? 'text-route' : 'text-brand-dark/60'}`}
        >
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${connected ? 'bg-route' : 'bg-brand-dark/30'}`} />
          {connected ? 'live' : 'connecting…'}
        </span>
      </div>
      <div className="font-display text-display mb-10">KES {totalKes.toLocaleString()}</div>

      <h2 className="text-xl font-semibold mb-3">By vehicle</h2>
      <div className="space-y-2">
        {Object.entries(byVehicle)
          .sort(([, a], [, b]) => b - a)
          .map(([code, amt]) => (
            <div key={code} className="flex justify-between items-center text-2xl bg-white rounded-xl p-4 border border-brand-dark/10">
              <span className="font-display">{code}</span>
              <span className="text-brand-dark/70">KES {amt.toLocaleString()}</span>
            </div>
          ))}
        {Object.keys(byVehicle).length === 0 && (
          <div className="text-center py-12">
            <p className="text-brand-dark/60 text-lg">
              {connected ? 'Waiting for the first fare of the day…' : 'Connecting to relays…'}
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-brand-dark/60 mt-10">Live via Nostr — relays: {RELAYS.join(', ')}</p>

      {vehicleCode && <ConductorNav active="sacco" vehicleCode={vehicleCode} saccoId={params.saccoId} />}
    </main>
  )
}
