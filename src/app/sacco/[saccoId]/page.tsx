'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import type { Filter } from 'nostr-tools/filter'
import { AppHeader } from '@/components/AppHeader'
import { isForSacco } from '@/lib/receipts'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']
const APP_PUBKEY = process.env.NEXT_PUBLIC_NOSTR_APP_PUBKEY!

// Live sacco-wide totals from public Nostr receipts. Not part of the
// conductor's screens: conductors see only their own vehicle's fares.
export default function SaccoPage({ params }: { params: { saccoId: string } }) {
  const [totalKes, setTotalKes] = useState(0)
  const [byVehicle, setByVehicle] = useState<Record<string, number>>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const pool = new SimplePool()
    const seen = new Set<string>()

    // Relays only index single-letter tags, so a '#sacco' filter matches
    // nothing. Ask for every Safaripap receipt ('#t') and keep this sacco's.
    const filter: Filter = {
      kinds: [1],
      authors: [APP_PUBKEY],
      '#t': ['matatu-payment'],
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
          if (!isForSacco(event.tags, params.saccoId)) return
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
    <main className="min-h-screen p-6 pb-10">
      <AppHeader />

      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="text-lg text-brand-dark/70">Sacco fares today</h1>
        <span
          className={`inline-flex items-center gap-2 text-sm font-medium ${connected ? 'text-route' : 'text-brand-dark/60'}`}
        >
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${connected ? 'bg-route' : 'bg-brand-dark/30'}`} />
          {connected ? 'live' : 'connecting…'}
        </span>
      </div>
      <div className="font-display text-display mb-10">KES {totalKes.toLocaleString()}</div>

      {Object.keys(byVehicle).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-brand-dark/60 text-lg">
            {connected ? 'Waiting for the first fare of the day…' : 'Connecting…'}
          </p>
        </div>
      ) : (
        <TablePanel title="By vehicle" aside={`KES ${totalKes.toLocaleString()}`}>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <caption className="sr-only">Fares today per vehicle</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={TH}>Vehicle</th>
                  <th scope="col" className={`${TH} text-right`}>KES</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byVehicle)
                  .sort(([, a], [, b]) => b - a)
                  .map(([code, amt]) => (
                    <tr key={code} className={ROW}>
                      <th scope="row" className={`${TD} font-display text-xl font-bold`}>{code}</th>
                      <td className={`${TD} text-right text-xl font-bold`}>{amt.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </TablePanel>
      )}

    </main>
  )
}
