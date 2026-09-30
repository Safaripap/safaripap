import type { Insights } from '@/lib/insights'
import { changeRatio } from '@/lib/insights'
import { formatKes, formatPercent, formatRange } from '@/lib/format'
import { DailyChart } from './DailyChart'
import { VehicleTable } from './VehicleTable'
import { DailyTable } from './DailyTable'

// Everything below the filters: the period total and how it compares, the
// daily chart, per-matatu totals, and the daily table. While new numbers load
// the old ones stay on screen, faded, so nothing jumps.
export function InsightsView({
  insights,
  loading = false,
  onPickVehicle,
}: {
  insights: Insights
  loading?: boolean
  onPickVehicle: (id: string) => void
}) {
  const days = insights.days.length
  const change = changeRatio(insights.totals.kes, insights.previous.kes)
  const periodWord = days === 1 ? 'the day before' : `the previous ${days} days`

  return (
    <div aria-busy={loading} className={`transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
      <section aria-labelledby="total-heading" className="mb-10">
        <h2 id="total-heading" className="text-lg text-brand-dark/70">
          Collected {formatRange(insights.from, insights.to)}
        </h2>
        <p className="font-display text-display">{formatKes(insights.totals.kes)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-lg">
          {change === null ? (
            <span className="text-brand-dark/70">No fares in {periodWord} to compare with.</span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${
                  change > 0 ? 'text-route' : change < 0 ? 'text-red-700' : 'text-brand-dark'
                }`}
              >
                {change !== 0 && (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={change > 0 ? 'M8 3l5 7H3z' : 'M8 13L3 6h10z'} />
                  </svg>
                )}
                {change > 0 ? 'Up' : change < 0 ? 'Down' : 'Level'} {formatPercent(Math.abs(change))}
              </span>
              <span className="text-brand-dark/70">
                vs {periodWord} ({formatKes(insights.previous.kes)})
              </span>
            </>
          )}
        </p>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="text-base text-brand-dark/70">Fares paid</dt>
            <dd className="text-2xl font-semibold">{insights.totals.fares.toLocaleString('en-KE')}</dd>
          </div>
          <div>
            <dt className="text-base text-brand-dark/70">Average fare</dt>
            <dd className="text-2xl font-semibold">
              {insights.totals.fares ? formatKes(insights.totals.avgKes) : '—'}
            </dd>
          </div>
          {insights.totals.vehicleCount > 1 && (
            <div>
              <dt className="text-base text-brand-dark/70">Matatus earning</dt>
              <dd className="text-2xl font-semibold">
                {insights.totals.activeVehicles} of {insights.totals.vehicleCount}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="daily-heading" className="mb-10">
        <h2 id="daily-heading" className="text-xl font-semibold mb-3">
          Fares per day
        </h2>
        <div className="rounded-2xl border-2 border-brand-dark/10 bg-white p-4">
          <DailyChart days={insights.daily} label={`Fares per day, ${formatRange(insights.from, insights.to)}`} />
        </div>
      </section>

      {insights.byVehicle.length > 1 && (
        <section aria-labelledby="vehicles-heading" className="mb-10">
          <h2 id="vehicles-heading" className="text-xl font-semibold mb-3">
            By matatu
          </h2>
          <VehicleTable vehicles={insights.byVehicle} onPick={onPickVehicle} />
        </section>
      )}

      <section aria-labelledby="table-heading">
        <h2 id="table-heading" className="text-xl font-semibold mb-3">
          {insights.byVehicle.length > 1 ? 'Daily totals per matatu' : 'Daily totals'}
        </h2>
        <DailyTable insights={insights} />
      </section>
    </div>
  )
}
