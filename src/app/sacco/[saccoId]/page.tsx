'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import type { Filter } from 'nostr-tools/filter'
import { AppHeader } from '@/components/AppHeader'
import Link from 'next/link'
import { isForSacco } from '@/lib/receipts'
import { APP_DATA_KIND, FARE_TOPIC, RELAYS, tagValue } from '@/lib/nostr-events'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'

// Kind 1 'matatu-payment' notes are the old format (before 5 Oct 2026); read
// them too so a day spanning the change still adds up.
const LEGACY_TOPIC = 'matatu-payment'
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
    // nothing. Ask for every Safaripap fare ('#t') and keep this sacco's.
    const filter: Filter = {
      kinds: [APP_DATA_KIND, 1],
      authors: [APP_PUBKEY],
      '#t': [FARE_TOPIC, LEGACY_TOPIC],
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
          // Relays can send duplicates, and a fare event re-published by the
          // sweep has a new id but the same address ('d' tag).
          const key = tagValue(event.tags, 'd') ?? event.id
          if (seen.has(key)) return
          seen.add(key)
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
      <AppHeader back={{ href: '/', label: 'Home' }} />

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

      <p className="mt-8 text-base text-brand-dark/70">
        These totals come from fares Safaripap signs and publishes on Nostr, so anyone can add them up.{' '}
        <Link href="/verify" className="font-semibold text-brand-dark underline underline-offset-4">
          Check a day&apos;s signed report
        </Link>
      </p>
    </main>
  )
}
