'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { ROLE_LABEL, type MemberRole } from '@/lib/member-login'
import { dayKey, validateRange, type Insights } from '@/lib/insights'
import { AppHeader } from '@/components/AppHeader'
import { DateRangeBar, presetRange, type Range } from '@/components/manage/DateRangeBar'
import { InsightsView } from '@/components/manage/InsightsView'
import { ManageTabs } from '@/components/manage/ManageTabs'

interface Me {
  role: MemberRole
  fullName: string
  saccoName: string
  vehicles: { id: string; vehicle_code: string }[]
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data } = await supabaseBrowser.auth.getSession()
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : null
}

// The dates and matatu filter live in the URL, so a refresh or a shared link
// shows the same view.
function readUrlState(today: string): { range: Range; vehicle: string } {
  const q = new URLSearchParams(window.location.search)
  const from = q.get('from') ?? ''
  const to = q.get('to') ?? ''
  const range = !validateRange(from, to) && to <= today ? { from, to } : presetRange('7d', today)
  return { range, vehicle: q.get('vehicle') ?? '' }
}

// Sacco managers see every matatu in their sacco; owners see theirs.
export default function ManagePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [today] = useState(() => dayKey(Date.now()))
  const [range, setRange] = useState<Range | null>(null)
  const [vehicle, setVehicle] = useState('')
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    ;(async () => {
      const headers = await authHeader()
      if (!headers) return router.replace('/manage/login')
      const res = await fetch('/api/manage/me', { headers })
      if (res.status === 401) {
        setError('This account isn’t a sacco manager or owner. Sign out and sign in with your phone number.')
        return
      }
      if (!res.ok) return setError('Couldn’t load your account. Check your connection and refresh.')
      const member: Me = await res.json()
      const initial = readUrlState(today)
      setMe(member)
      setRange(initial.range)
      setVehicle(member.vehicles.some((v) => v.id === initial.vehicle) ? initial.vehicle : '')
    })()
  }, [router, today])

  const load = useCallback(async () => {
    if (!range) return
    const headers = await authHeader()
    if (!headers) return router.replace('/manage/login')
    setLoading(true)
    setLoadError('')
    const q = new URLSearchParams({ from: range.from, to: range.to, ...(vehicle ? { vehicle } : {}) })
    window.history.replaceState(null, '', `/manage?${q}`)
    try {
      const res = await fetch(`/api/manage/insights?${q}`, { headers })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setInsights(body)
    } catch (err: any) {
      setLoadError(err?.message || 'Couldn’t load fares. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [range, vehicle, router])

  useEffect(() => {
    load()
  }, [load])

  async function downloadCsv() {
    if (!range) return
    const headers = await authHeader()
    if (!headers) return
    const q = new URLSearchParams({ from: range.from, to: range.to, format: 'csv', ...(vehicle ? { vehicle } : {}) })
    const res = await fetch(`/api/manage/insights?${q}`, { headers })
    if (!res.ok) return setLoadError('Couldn’t prepare the spreadsheet. Try again.')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `safaripap-fares-${range.from}-to-${range.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.replace('/manage/login')
  }

  const vehicleCode = me?.vehicles.find((v) => v.id === vehicle)?.vehicle_code

  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <AppHeader />

        {!me && !error && <p role="status" className="text-brand-dark/70">Loading…</p>}

        {error && (
          <div className="max-w-md">
            <p role="alert" className="text-lg text-red-700 mb-4">
              {error}
            </p>
            <button onClick={signOut} className="rounded-2xl bg-brand-dark px-6 font-display font-bold text-lg text-cream">
              Sign out
            </button>
          </div>
        )}

        {me && range && (
          <>
            <ManageTabs active="takings" />
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-lg text-brand-dark/70">
                  {ROLE_LABEL[me.role]} · {me.saccoName}
                </p>
                <h1 className="font-display text-display-sm">Fares{vehicleCode ? ` · ${vehicleCode}` : ''}</h1>
              </div>
              <button onClick={signOut} className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold">
                Sign out
              </button>
            </div>

            {/* Filters scope everything below them. */}
            <section aria-label="Filters" className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <DateRangeBar range={range} today={today} onChange={setRange} />
              <div className="flex flex-wrap items-end gap-3">
                {me.vehicles.length > 1 && (
                  <div>
                    <label htmlFor="vehicle-filter" className="block text-sm font-semibold text-brand-dark mb-1">
                      Matatu
                    </label>
                    <select
                      id="vehicle-filter"
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value)}
                      className="min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-3 text-base focus:border-brand outline-none"
                    >
                      <option value="">All {me.vehicles.length} matatus</option>
                      {me.vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehicle_code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={downloadCsv}
                  disabled={!insights}
                  className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold disabled:opacity-40"
                >
                  Download spreadsheet
                </button>
              </div>
            </section>

            {loadError && (
              <p role="alert" className="mb-6 rounded-xl border-2 border-red-700/30 bg-white p-4 text-red-700">
                {loadError}
              </p>
            )}

            {!insights && !loadError && <p role="status" className="text-brand-dark/70">Loading fares…</p>}

            {insights && <InsightsView insights={insights} loading={loading} onPickVehicle={setVehicle} />}
          </>
        )}
      </div>
    </main>
  )
}
