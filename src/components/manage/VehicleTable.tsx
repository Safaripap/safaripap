import type { VehicleInsight } from '@/lib/insights'
import { formatDay, formatKes, formatPercent } from '@/lib/format'

// Per-matatu totals for the period, biggest earner first. Tapping a matatu
// narrows the whole dashboard to it.
export function VehicleTable({ vehicles, onPick }: { vehicles: VehicleInsight[]; onPick: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-brand-dark/10 bg-white">
      <table className="w-full text-left">
        <caption className="sr-only">Fare totals per matatu for the selected dates</caption>
        <thead className="text-sm text-brand-dark/70">
          <tr className="border-b-2 border-brand-dark/10">
            <th scope="col" className="px-3 py-3 sm:px-4 font-semibold">Matatu</th>
            <th scope="col" className="px-3 py-3 sm:px-4 font-semibold text-right">Total</th>
            <th scope="col" className="hidden px-3 py-3 sm:px-4 font-semibold text-right sm:table-cell">Fares</th>
            <th scope="col" className="hidden px-3 py-3 sm:px-4 font-semibold text-right sm:table-cell">Avg fare</th>
            <th scope="col" className="px-3 py-3 sm:px-4 font-semibold">Share</th>
            <th scope="col" className="hidden px-3 py-3 sm:px-4 font-semibold md:table-cell">Best day</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.vehicleId} className="border-b border-brand-dark/10 last:border-0">
              <th scope="row" className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => onPick(v.vehicleId)}
                  aria-label={`Show only ${v.code}`}
                  className="min-h-[3.25rem] rounded-lg px-2 font-display font-bold tabular-nums underline decoration-brand-dark/30 underline-offset-4"
                >
                  {v.code}
                </button>
              </th>
              <td className="px-3 py-2 sm:px-4 text-right font-semibold tabular-nums whitespace-nowrap">{formatKes(v.kes)}</td>
              <td className="hidden px-3 py-2 sm:px-4 text-right tabular-nums sm:table-cell">{v.fares}</td>
              <td className="hidden px-3 py-2 sm:px-4 text-right tabular-nums sm:table-cell whitespace-nowrap">
                {v.fares ? formatKes(v.avgKes) : '—'}
              </td>
              <td className="px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right tabular-nums">{formatPercent(v.share)}</span>
                  <span aria-hidden="true" className="hidden h-2 w-20 overflow-hidden rounded-full bg-brand-dark/10 sm:block">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${v.share * 100}%` }} />
                  </span>
                </div>
              </td>
              <td className="hidden px-3 py-2 sm:px-4 md:table-cell whitespace-nowrap">
                {v.bestDay ? (
                  <>
                    {formatDay(v.bestDay.date)} <span className="text-brand-dark/70 tabular-nums">· {formatKes(v.bestDay.kes)}</span>
                  </>
                ) : (
                  <span className="text-brand-dark/70">No fares</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
