import type { Insights } from '@/lib/insights'
import { formatDay, formatKes } from '@/lib/format'

// The chart's table view: every day as a row, a column per matatu when there
// are several, then the day's total. Newest day first. Scrolls sideways on a
// phone with the date column pinned.
export function DailyTable({ insights }: { insights: Insights }) {
  const multi = insights.byVehicle.length > 1
  const rows = insights.daily.map((d, i) => ({ ...d, i })).reverse()
  return (
    <div className="max-h-[32rem] overflow-auto rounded-2xl border-2 border-brand-dark/10 bg-white">
      <table className="w-full text-left tabular-nums">
        <caption className="sr-only">Daily fare totals{multi ? ' per matatu' : ''}</caption>
        <thead className="sticky top-0 z-10 bg-white text-sm text-brand-dark/70">
          <tr className="border-b-2 border-brand-dark/10">
            <th scope="col" className="sticky left-0 bg-white px-4 py-3 font-semibold">Day</th>
            {multi &&
              insights.byVehicle.map((v) => (
                <th key={v.vehicleId} scope="col" className="px-4 py-3 font-display font-bold text-right text-brand-dark whitespace-nowrap">
                  {v.code}
                </th>
              ))}
            <th scope="col" className="px-4 py-3 font-semibold text-right">Fares</th>
            <th scope="col" className="px-4 py-3 font-semibold text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.date} className="border-b border-brand-dark/10 last:border-0">
              <th scope="row" className="sticky left-0 bg-white px-4 py-3 font-semibold whitespace-nowrap">
                {formatDay(d.date)}
              </th>
              {multi &&
                insights.byVehicle.map((v) => (
                  <td key={v.vehicleId} className={`px-4 py-3 text-right whitespace-nowrap ${v.daily[d.i] ? '' : 'text-brand-dark/60'}`}>
                    {v.daily[d.i] ? v.daily[d.i].toLocaleString('en-KE') : '—'}
                  </td>
                ))}
              <td className="px-4 py-3 text-right">{d.fares}</td>
              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatKes(d.kes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
