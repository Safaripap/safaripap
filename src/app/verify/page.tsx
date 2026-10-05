'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { neventEncode, npubEncode } from 'nostr-tools/nip19'
import type { Event } from 'nostr-tools/pure'
import { AppHeader } from '@/components/AppHeader'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'
import { APP_DATA_KIND, faresHash, RELAYS, reportAddress, tagValue, type ReportFare } from '@/lib/nostr-events'

const APP_PUBKEY = process.env.NEXT_PUBLIC_NOSTR_APP_PUBKEY!
const EAT_OFFSET_MS = 3 * 3600_000
const yesterday = () => new Date(Date.now() + EAT_OFFSET_MS - 24 * 3600_000).toISOString().slice(0, 10)

type Result =
  | { state: 'checking' }
  | { state: 'error'; message: string }
  | {
      state: 'done'
      vehicleCode: string
      date: string
      fares: ReportFare[]
      ourHash: string
      report: { event: Event; hash: string | undefined; totals: { fares: number; kes: number; sats: number } } | null
    }

// Anyone can check a vehicle's day: the browser fetches the signed report
// straight from public Nostr relays (not from Safaripap), hashes the day's
// fare list the same way the report did, and compares the two.
export default function VerifyPage() {
  const [vehicle, setVehicle] = useState('')
  const [date, setDate] = useState(yesterday)
  const [ending, setEnding] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  // A shared link (?vehicle=KAB123B&date=2026-10-04) checks straight away.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const v = q.get('vehicle')
    const d = q.get('date')
    if (v) setVehicle(v.toUpperCase())
    if (d) setDate(d)
    if (v) check(v, d ?? yesterday())
  }, [])

  async function check(code = vehicle, day = date) {
    code = code.replace(/\s+/g, '').toUpperCase()
    if (!code) return
    setResult({ state: 'checking' })
    window.history.replaceState(null, '', `/verify?vehicle=${code}&date=${day}`)
    try {
      const res = await fetch(`/api/verify?vehicle=${encodeURIComponent(code)}&date=${day}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)

      const pool = new SimplePool()
      const events = await pool.querySync(
        RELAYS,
        { kinds: [APP_DATA_KIND], authors: [APP_PUBKEY], '#d': [reportAddress(body.vehicleCode, day)] },
        { maxWait: 6000 }
      )
      pool.close(RELAYS)
      // The newest version of the report wins (it's replaceable).
      const event = events.sort((a, b) => b.created_at - a.created_at)[0]
      let report = null
      if (event) {
        const content = JSON.parse(event.content)
        report = {
          event,
          hash: tagValue(event.tags, 'hash'),
          totals: { fares: content.fares, kes: content.kes, sats: content.sats },
        }
      }
      setResult({ state: 'done', vehicleCode: body.vehicleCode, date: day, fares: body.fares, ourHash: faresHash(body.fares), report })
    } catch (err: any) {
      setResult({ state: 'error', message: err?.message || 'Couldn’t check right now. Try again.' })
    }
  }

  const match = result?.state === 'done' && result.report && result.report.hash === result.ourHash
  const q = ending.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const shown = result?.state === 'done' ? result.fares.filter((f) => !q || (f.receipt_last3 ?? '').endsWith(q)) : []

  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />
        <h1 className="font-display text-display-sm">Check a day&apos;s fares</h1>
        <p className="mt-2 text-lg text-brand-dark/70">
          Every night Safaripap signs a report of each matatu&apos;s paid fares and publishes it on Nostr, a public
          network no one can quietly edit. Check that today&apos;s numbers still match what was signed.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <div>
            <label htmlFor="verify-vehicle" className="mb-1 block text-sm font-semibold">Matatu</label>
            <input
              id="verify-vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value.toUpperCase())}
              placeholder="KAB123B"
              autoCapitalize="characters"
              className="min-h-[3.25rem] w-full rounded-xl border-2 border-brand-dark/15 bg-white px-4 font-display text-xl font-bold outline-none focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="verify-date" className="mb-1 block text-sm font-semibold">Day</label>
            <input
              id="verify-date"
              type="date"
              value={date}
              max={new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[3.25rem] w-full rounded-xl border-2 border-brand-dark/15 bg-white px-3 text-lg outline-none focus:border-brand"
            />
          </div>
          <button type="submit" disabled={!vehicle || result?.state === 'checking'} className="rounded-xl bg-brand-dark px-6 font-display text-lg font-bold text-cream disabled:opacity-40">
            {result?.state === 'checking' ? 'Checking…' : 'Check'}
          </button>
        </form>

        <div aria-live="polite" className="mt-8">
          {result?.state === 'error' && <p role="alert" className="text-lg text-red-700">{result.message}</p>}

          {result?.state === 'done' && (
            <div className="space-y-6">
              {!result.report ? (
                <Verdict tone="neutral" title="No signed report for this day yet">
                  Reports for a day are published just after midnight. {result.fares.length} paid{' '}
                  {result.fares.length === 1 ? 'fare' : 'fares'} so far.
                </Verdict>
              ) : match ? (
                <Verdict tone="good" title="Matches the signed report">
                  {result.report.totals.fares} fares, KES {result.report.totals.kes.toLocaleString('en-KE')}
                  {result.report.totals.sats ? `, ${result.report.totals.sats.toLocaleString('en-KE')} sats to the matatu` : ''}. Nothing
                  has changed since it was signed.
                </Verdict>
              ) : (
                <Verdict tone="bad" title="Doesn’t match the signed report">
                  The report signed {result.report.totals.fares} fares, KES {result.report.totals.kes.toLocaleString('en-KE')}; today
                  the records show {result.fares.length} fares, KES{' '}
                  {result.fares.reduce((s, f) => s + f.amount_kes, 0).toLocaleString('en-KE')}. The fare list changed after signing.
                </Verdict>
              )}

              {result.report && (
                <dl className="grid gap-2 text-sm text-brand-dark/70">
                  <div>
                    <dt className="inline font-semibold text-brand-dark">Signed by </dt>
                    <dd className="inline break-all">{npubEncode(APP_PUBKEY)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-brand-dark">Report hash </dt>
                    <dd className="inline break-all font-mono">{result.report.hash}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-brand-dark">Hash of today&apos;s records </dt>
                    <dd className="inline break-all font-mono">{result.ourHash}</dd>
                  </div>
                  <div>
                    <a
                      href={`https://njump.me/${neventEncode({ id: result.report.event.id, relays: RELAYS.slice(0, 2), author: APP_PUBKEY })}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-dark underline underline-offset-4"
                    >
                      See the report on Nostr
                    </a>
                  </div>
                </dl>
              )}

              {result.fares.length > 0 && (
                <section aria-labelledby="fares-heading">
                  <div className="mb-3">
                    <label htmlFor="verify-ending" className="mb-1 block text-sm font-semibold">
                      Find your fare: last 3 characters of your M-Pesa receipt
                    </label>
                    <input
                      id="verify-ending"
                      value={ending}
                      onChange={(e) => setEnding(e.target.value)}
                      maxLength={3}
                      autoCapitalize="characters"
                      className="min-h-[3.25rem] w-32 rounded-xl border-2 border-brand-dark/15 bg-white px-4 font-display text-xl font-bold uppercase outline-none focus:border-brand"
                    />
                    {q.length === 3 && (
                      <p role="status" className="mt-2 text-base">
                        {shown.length ? `Found: ${shown.map((f) => `KES ${f.amount_kes}`).join(', ')}` : `No fare ending ${q} on this day.`}
                      </p>
                    )}
                  </div>
                  <TablePanel title={`${result.vehicleCode} · ${result.date}`} headingId="fares-heading">
                    <div className="max-h-[28rem] overflow-auto">
                      <table className={TABLE}>
                        <caption className="sr-only">Paid fares on this day, by receipt ending</caption>
                        <thead className={THEAD}>
                          <tr>
                            <th scope="col" className={TH}>Receipt ends</th>
                            <th scope="col" className={`${TH} text-right`}>KES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((f) => (
                            <tr key={f.id} className={ROW}>
                              <th scope="row" className={`${TD} font-display font-bold`}>{f.receipt_last3 || '—'}</th>
                              <td className={`${TD} text-right font-bold`}>{f.amount_kes.toLocaleString('en-KE')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TablePanel>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Verdict({ tone, title, children }: { tone: 'good' | 'bad' | 'neutral'; title: string; children: React.ReactNode }) {
  const styles = {
    good: 'border-route bg-route-light text-route',
    bad: 'border-red-700 bg-red-50 text-red-800',
    neutral: 'border-brand-dark/15 bg-white text-brand-dark',
  }[tone]
  return (
    <div className={`rounded-2xl border-2 p-4 ${styles}`}>
      <p className="font-display text-xl font-bold">
        <span aria-hidden="true">{tone === 'good' ? '✓ ' : tone === 'bad' ? '✗ ' : ''}</span>
        {title}
      </p>
      <p className="mt-1 text-base text-brand-dark">{children}</p>
    </div>
  )
}
