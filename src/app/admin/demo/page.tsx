'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { AdminNav } from '@/components/AdminNav'
import { AdminGate } from '@/components/AdminGate'
import { DEMO_LIMITS } from '@/lib/demo-data'

interface Sacco {
  id: string
  name: string
  vehicles: { id: string; vehicleCode: string; isDemo?: boolean }[]
}

const INPUT =
  'w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg text-brand-dark focus:border-brand outline-none'
const LABEL = 'block text-base font-semibold text-brand-dark mb-1'

export default function DemoDataPage() {
  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />
        <AdminGate title="Demo data">{(lock) => <DemoData lock={lock} />}</AdminGate>
      </div>
    </main>
  )
}

function DemoData({ lock }: { lock: () => void }) {
  const [saccos, setSaccos] = useState<Sacco[] | null>(null)
  const [saccoId, setSaccoId] = useState('')
  const [vehicles, setVehicles] = useState(8)
  const [days, setDays] = useState(60)
  const [busy, setBusy] = useState<'generating' | 'clearing' | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/saccos')
    if (res.status === 401) return lock()
    const body = await res.json().catch(() => ({ saccos: [] }))
    setSaccos(body.saccos ?? [])
    setSaccoId((id) => id || body.saccos?.[0]?.id || '')
  }, [lock])

  useEffect(() => {
    load()
  }, [load])

  const sacco = saccos?.find((s) => s.id === saccoId)
  const real = sacco?.vehicles.filter((v) => !v.isDemo) ?? []
  const demo = sacco?.vehicles.filter((v) => v.isDemo) ?? []

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setBusy('generating')
    const res = await fetch('/api/admin/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saccoId, vehicles, days }),
    }).catch(() => null)
    setBusy(null)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setMessage({ kind: 'error', text: body?.error || 'Could not reach the server. Try again.' })
    setMessage({
      kind: 'ok',
      text: `Added ${body.vehicles.length} demo matatus with ${body.fares.toLocaleString('en-KE')} fares over ${days} days.`,
    })
    load()
  }

  async function clear() {
    setMessage(null)
    setConfirmClear(false)
    setBusy('clearing')
    const res = await fetch(`/api/admin/demo?saccoId=${encodeURIComponent(saccoId)}`, { method: 'DELETE' }).catch(() => null)
    setBusy(null)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setMessage({ kind: 'error', text: body?.error || 'Could not clear demo data. Try again.' })
    setMessage({ kind: 'ok', text: `Removed ${body.vehicles} demo matatus and their fares.` })
    load()
  }

  return (
    <>
      <AdminNav active="demo" />
      <h1 className="font-display text-display-sm mb-2">Demo data</h1>
      <p className="text-lg text-brand-dark/70 mb-8">
        Fills a sacco with placeholder matatus and a realistic fare history, so the manager dashboard looks like a working
        sacco. Demo matatus are labelled <strong>Demo</strong> on the dashboard and can never take real payments. Real
        matatus and real fares are never changed.
      </p>

      <form onSubmit={generate} className="mb-8 max-w-lg space-y-5 rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
        <div>
          <label htmlFor="demo-sacco" className={LABEL}>
            Sacco
          </label>
          <select
            id="demo-sacco"
            value={saccoId}
            onChange={(e) => {
              setSaccoId(e.target.value)
              setMessage(null)
              setConfirmClear(false)
            }}
            disabled={!saccos?.length}
            className={`${INPUT} disabled:opacity-60`}
          >
            {!saccos && <option value="">Loading saccos…</option>}
            {saccos?.length === 0 && <option value="">No saccos yet: onboard a matatu first</option>}
            {saccos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {sacco && (
            <p className="mt-2 text-brand-dark/70">
              {real.length} real {real.length === 1 ? 'matatu' : 'matatus'}
              {real.length > 0 && (
                <span className="font-display font-bold tabular-nums text-brand-dark"> ({real.map((v) => v.vehicleCode).join(', ')})</span>
              )}{' '}
              · {demo.length} demo
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="demo-vehicles" className={LABEL}>
              Demo matatus to add
            </label>
            <input
              id="demo-vehicles"
              type="number"
              inputMode="numeric"
              min={DEMO_LIMITS.vehicles.min}
              max={DEMO_LIMITS.vehicles.max}
              value={vehicles}
              onChange={(e) => setVehicles(Number(e.target.value))}
              className={`${INPUT} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="demo-days" className={LABEL}>
              Days of history
            </label>
            <input
              id="demo-days"
              type="number"
              inputMode="numeric"
              min={DEMO_LIMITS.days.min}
              max={DEMO_LIMITS.days.max}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className={`${INPUT} tabular-nums`}
            />
          </div>
        </div>
        <p className="text-sm text-brand-dark/70">
          Up to {DEMO_LIMITS.vehicles.max} matatus and {DEMO_LIMITS.days.max} days. Busier on weekdays and at rush hour,
          with fares up to right now. Takes a few seconds.
        </p>

        <button
          type="submit"
          disabled={!saccoId || busy !== null}
          className="w-full rounded-2xl bg-brand text-white font-display font-bold text-xl px-4 disabled:opacity-40"
        >
          {busy === 'generating' ? 'Generating…' : `Add ${vehicles} demo matatus`}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {message && (
          <p
            className={`mb-6 max-w-lg rounded-xl border-2 p-4 ${
              message.kind === 'ok' ? 'border-route bg-route-light text-brand-dark' : 'border-red-700/30 bg-white text-red-700'
            }`}
          >
            {message.text}
            {message.kind === 'ok' && busy === null && (
              <>
                {' '}
                <Link href="/manage" className="font-semibold underline underline-offset-4">
                  Open the manager dashboard
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {demo.length > 0 && (
        <section aria-labelledby="clear-heading" className="max-w-lg rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
          <h2 id="clear-heading" className="text-xl font-semibold">
            Demo matatus in {sacco?.name}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {demo.map((v) => (
              <li key={v.id} className="rounded-full bg-brand-dark/5 px-3 py-1 font-display font-bold tabular-nums">
                {v.vehicleCode}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {confirmClear ? (
              <>
                <button onClick={clear} disabled={busy !== null} className="rounded-xl bg-red-700 px-4 text-base font-semibold text-white">
                  {busy === 'clearing' ? 'Removing…' : `Yes, remove ${demo.length} demo matatus`}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold"
                >
                  Keep them
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold text-red-700"
              >
                Remove demo data
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
