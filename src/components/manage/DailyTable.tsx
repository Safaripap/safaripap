import type { Insights } from '@/lib/insights'
import { formatDay, formatKes } from '@/lib/format'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'

// The chart's table view: every day as a row, a column per matatu when there
// are several, then the day's total. Newest day first. Scrolls sideways on a
// phone with the date column pinned.
export function DailyTable({ insights, title, headingId }: { insights: Insights; title: string; headingId: string }) {
  const multi = insights.byVehicle.length > 1
  const rows = insights.daily.map((d, i) => ({ ...d, i })).reverse()
  return (
    <TablePanel title={title} headingId={headingId}>
      <div className="max-h-[32rem] overflow-auto">
        <table className={TABLE}>
          <caption className="sr-only">Daily fare totals{multi ? ' per matatu' : ''}</caption>
          <thead className={`${THEAD} sticky top-0 z-10 bg-white`}>
            <tr>
              <th scope="col" className={`${TH} sticky left-0 bg-white`}>Day</th>
              {multi &&
                insights.byVehicle.map((v) => (
                  <th key={v.vehicleId} scope="col" className={`${TH} whitespace-nowrap text-right font-display font-bold normal-case text-brand-dark`}>
                    {v.code}
                  </th>
                ))}
              <th scope="col" className={`${TH} text-right`}>Fares</th>
              <th scope="col" className={`${TH} text-right`}>KES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.date} className={ROW}>
                <th scope="row" className={`${TD} sticky left-0 whitespace-nowrap bg-white font-semibold`}>
                  {formatDay(d.date)}
                </th>
                {multi &&
                  insights.byVehicle.map((v) => (
                    <td key={v.vehicleId} className={`${TD} whitespace-nowrap text-right ${v.daily[d.i] ? '' : 'text-brand-dark/60'}`}>
                      {v.daily[d.i] ? v.daily[d.i].toLocaleString('en-KE') : '—'}
                    </td>
                  ))}
                <td className={`${TD} text-right`}>{d.fares}</td>
                <td className={`${TD} whitespace-nowrap text-right font-bold`}>{formatKes(d.kes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TablePanel>
  )
}
