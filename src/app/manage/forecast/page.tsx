'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { SaccoForecast } from '@/lib/forecast'
import { AppHeader } from '@/components/AppHeader'
import { ManageTabs } from '@/components/manage/ManageTabs'
import { HourlyBars } from '@/components/manage/HourlyBars'
import { AiBriefing } from '@/components/manage/AiBriefing'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

async function authHeader(): Promise<Record<string, string> | null> {
  const { data } = await supabaseBrowser.auth.getSession()
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : null
}

// Tomorrow's projected takings, busiest hours and best shift, plus how today
// is tracking. Ported from Nauli Sacco's forecast view.
export default function ForecastPage() {
  const router = useRouter()
  const [f, setF] = useState<(SaccoForecast & { aiSummary?: boolean }) | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const headers = await authHeader()
      if (!headers) return router.replace('/manage/login')
      try {
        const res = await fetch('/api/manage/forecast', { headers })
        const body = await res.json()
        if (res.status === 401) throw new Error('This account isn’t a sacco manager or owner.')
        if (!res.ok) throw new Error(body.error)
        setF(body)
      } catch (err: any) {
        setError(err?.message || 'Couldn’t load the forecast. Check your connection and refresh.')
      }
    })()
  }, [router])

  const todayActual = f?.vehicles.reduce((s, v) => s + v.todayActualKes, 0) ?? 0
  const todayProjected = f?.vehicles.reduce((s, v) => s + v.todayProjectedSoFarKes, 0) ?? 0
  const pace = todayProjected > 0 ? Math.round((todayActual / todayProjected) * 100) : null

  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <AppHeader />
        <ManageTabs active="forecast" />

        {!f && !error && <p role="status" className="text-brand-dark/70">Loading forecast…</p>}
        {error && (
          <p role="alert" className="rounded-xl border-2 border-red-700/30 bg-white p-4 text-red-700">
            {error}
          </p>
        )}

        {f && (
          <div className="space-y-10">
            <section aria-labelledby="forecast-heading">
              <p className="text-lg text-brand-dark/70">{f.saccoName}</p>
              <h1 id="forecast-heading" className="font-display text-display-sm">
                Tomorrow · {f.tomorrow.weekday} {f.tomorrow.date}
              </h1>
              <p className="text-base text-brand-dark/70">Projected from the average of the last 4 {f.tomorrow.weekday}s.</p>

              <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border-2 border-brand-dark bg-white sm:grid-cols-4">
                {[
                  { label: 'Projected KES', value: `KES ${f.fleet.tomorrowKes.toLocaleString('en-KE')}` },
                  { label: 'Projected fares', value: f.fleet.tomorrowFares.toLocaleString('en-KE') },
                  { label: 'Peak hours', value: f.fleet.peakHours.map(hh).join(', ') || '—' },
                  { label: 'Best 8h shift', value: `${hh(f.fleet.shift.start)}–${hh(f.fleet.shift.end)}` },
                ].map((t) => (
                  <div key={t.label} className="border-b-2 border-r-2 border-brand-dark/10 px-4 py-3 sm:border-b-0">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-brand-dark/70">{t.label}</dt>
                    <dd className="font-display text-2xl font-extrabold tabular-nums leading-tight">{t.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {f.aiSummary && <AiBriefing />}

            <section className="rounded-2xl border-2 border-brand-dark/10 bg-white p-4">
              <HourlyBars
                title={`Projected KES by hour · ${f.tomorrow.weekday}`}
                bars={{ label: 'Projected', values: f.fleet.tomorrowHourly }}
                highlight={{ ...f.fleet.shift, label: 'Best 8h shift' }}
              />
            </section>

            <section className="space-y-2 rounded-2xl border-2 border-brand-dark/10 bg-white p-4">
              <HourlyBars
                title={`Today so far · ${f.today.weekday}`}
                bars={{ label: 'Actual', values: f.fleet.todayActualHourly }}
                line={{ label: 'Projected', values: f.fleet.todayProjectedHourly }}
                upToHour={f.today.currentHour}
              />
              <p className="text-base">
                Through {hh(f.today.currentHour)}: KES {todayActual.toLocaleString('en-KE')} actual vs KES{' '}
                {todayProjected.toLocaleString('en-KE')} projected
                {pace !== null ? ` (${pace}% of usual)` : ''}.
              </p>
            </section>

            <section aria-labelledby="by-vehicle-heading">
              <TablePanel title="By matatu · tomorrow" headingId="by-vehicle-heading">
                <div className="overflow-x-auto">
                  <table className={`${TABLE} min-w-[560px]`}>
                    <thead className={THEAD}>
                      <tr>
                        <th scope="col" className={TH}>Matatu</th>
                        <th scope="col" className={TH}>Conductor</th>
                        <th scope="col" className={`${TH} text-right`}>Projected KES</th>
                        <th scope="col" className={`${TH} text-right`}>Fares</th>
                        <th scope="col" className={TH}>Peak hours</th>
                        <th scope="col" className={TH}>Best shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.vehicles.map((v) => (
                        <tr key={v.vehicleCode} className={ROW}>
                          <th scope="row" className={`${TD} font-display font-bold`}>{v.vehicleCode}</th>
                          <td className={TD}>{v.conductorName ?? '—'}</td>
                          <td className={`${TD} text-right font-bold`}>{v.tomorrowKes.toLocaleString('en-KE')}</td>
                          <td className={`${TD} text-right`}>{v.tomorrowFares}</td>
                          <td className={TD}>{v.peakHours.map(hh).join(', ') || '—'}</td>
                          <td className={`${TD} whitespace-nowrap`}>
                            {hh(v.shift.start)}–{hh(v.shift.end)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TablePanel>
            </section>

            <p className="text-sm text-brand-dark/70">
              Statistical projection: mean takings per weekday and hour over the last 28 days. Not a trained model;
              holidays and weather aren&apos;t accounted for.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
