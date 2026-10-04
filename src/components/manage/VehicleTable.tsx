import type { VehicleInsight } from '@/lib/insights'
import { formatDay, formatKes, formatPercent } from '@/lib/format'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'

// Per-matatu totals for the period, biggest earner first. Tapping a matatu
// narrows the whole dashboard to it.
export function VehicleTable({
  vehicles,
  onPick,
  title,
  headingId,
}: {
  vehicles: VehicleInsight[]
  onPick: (id: string) => void
  title: string
  headingId: string
}) {
  const total = vehicles.reduce((sum, v) => sum + v.kes, 0)
  return (
    <TablePanel title={title} headingId={headingId} aside={`${formatKes(total)} · ${vehicles.length} matatus`}>
      <div className="overflow-x-auto">
        <table className={TABLE}>
          <caption className="sr-only">Fare totals per matatu for the selected dates</caption>
          <thead className={THEAD}>
            <tr>
              <th scope="col" className={TH}>Matatu</th>
              <th scope="col" className={`${TH} text-right`}>KES</th>
              <th scope="col" className={`${TH} hidden text-right sm:table-cell`}>Fares</th>
              <th scope="col" className={`${TH} hidden text-right sm:table-cell`}>Avg fare</th>
              <th scope="col" className={TH}>Share</th>
              <th scope="col" className={`${TH} hidden md:table-cell`}>Best day</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.vehicleId} className={ROW}>
                <th scope="row" className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => onPick(v.vehicleId)}
                    aria-label={`Show only ${v.code}`}
                    className="min-h-[3.25rem] rounded-lg px-2 font-display font-bold tabular-nums underline decoration-brand-dark/30 underline-offset-4"
                  >
                    {v.code}
                  </button>
                  {v.demo && <DemoTag />}
                </th>
                <td className={`${TD} whitespace-nowrap text-right font-bold`}>{v.kes.toLocaleString('en-KE')}</td>
                <td className={`${TD} hidden text-right sm:table-cell`}>{v.fares}</td>
                <td className={`${TD} hidden whitespace-nowrap text-right sm:table-cell`}>
                  {v.fares ? formatKes(v.avgKes) : '—'}
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right">{formatPercent(v.share)}</span>
                    <span aria-hidden="true" className="hidden h-2 w-20 overflow-hidden rounded-full bg-brand-dark/10 sm:block">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${v.share * 100}%` }} />
                    </span>
                  </div>
                </td>
                <td className={`${TD} hidden whitespace-nowrap text-sm md:table-cell`}>
                  {v.bestDay ? (
                    <>
                      {formatDay(v.bestDay.date)} <span className="text-brand-dark/70">· {formatKes(v.bestDay.kes)}</span>
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
    </TablePanel>
  )
}

// Marks placeholder matatus whose fares were generated for the demo.
export function DemoTag() {
  return (
    <span className="ml-1 inline-block rounded-full bg-brand-dark/5 px-2 py-0.5 align-middle text-xs font-semibold text-brand-dark/70">
      Demo
    </span>
  )
}
