import { Highlight } from '@/components/Highlight'
import { ROW, TABLE, TablePanel, TD, TH, THEAD } from '@/components/TablePanel'
import { formatWhen, statusOf, type Tone, type Txn } from '@/lib/fares'

// The conductor's live fare list as a table, in the same Nauli-style panel as
// the owner and sacco tables. Each row: phone and receipt endings (what the
// passenger reads out), fare, time and status. A paid fare that isn't
// verified yet gets a Verify button in its status cell.

export const PILL_CLASSES: Record<Tone, string> = {
  route: 'bg-route-light text-route',
  wait: 'bg-wait-light text-wait-ink',
  neutral: 'bg-brand-dark/5 text-brand-dark/70',
}

export function FareTable({
  rows,
  query,
  fullReceiptQuery,
  fresh,
  busy,
  onVerify,
}: {
  rows: Txn[]
  query: string // ending typed into search, highlighted in the endings
  fullReceiptQuery: string // full-receipt search, highlighted in the full receipt
  fresh: Record<string, Tone> // rows that just arrived, flashed with their status tint
  busy: boolean
  onVerify: (id: string) => void
}) {
  return (
    <TablePanel>
      <div className="overflow-x-auto">
        <table className={`${TABLE} ${busy ? 'opacity-60' : ''}`} aria-busy={busy}>
          <caption className="sr-only">Fares for this matatu, with phone and receipt endings</caption>
          <thead className={THEAD}>
            <tr>
              <th scope="col" className={TH}>Phone / receipt</th>
              <th scope="col" className={`${TH} text-right`}>KES</th>
              <th scope="col" className={`${TH} hidden sm:table-cell`}>Time</th>
              <th scope="col" className={`${TH} text-right`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = statusOf(r)
              const canVerify = !r.verified_by_conductor && r.status === 'fulfilled'
              const tint = fresh[r.id]
              return (
                <tr key={r.id} className={`${ROW} motion-row-highlight ${tint ? `is-new-${tint}` : ''}`}>
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    <span className="font-display text-2xl font-extrabold tracking-wide text-brand-dark sm:text-3xl">
                      <span className="sr-only">Phone ending </span>
                      <Highlight text={r.phone_last3} query={query} />
                      <span aria-hidden="true" className="mx-2 text-brand-dark/30">/</span>
                      <span className="sr-only">, receipt ending </span>
                      {r.receipt_last3 ? (
                        <Highlight text={r.receipt_last3} query={query} />
                      ) : (
                        <span className="text-brand-dark/30" aria-label="pending">—</span>
                      )}
                    </span>
                    {r.mpesa_receipt && (
                      <span className="mt-1 block break-all text-sm text-brand-dark/70">
                        Receipt{' '}
                        <span className="font-semibold text-brand-dark">
                          <Highlight text={r.mpesa_receipt} query={fullReceiptQuery} suffix />
                        </span>
                      </span>
                    )}
                    {/* On a phone the time column is hidden; show it here. */}
                    <span className="mt-1 block text-sm text-brand-dark/70 sm:hidden">{formatWhen(r.created_at)}</span>
                  </th>
                  <td className={`${TD} whitespace-nowrap text-right text-lg font-bold`}>{r.amount_kes.toLocaleString('en-KE')}</td>
                  <td className={`${TD} hidden whitespace-nowrap text-brand-dark/70 sm:table-cell`}>{formatWhen(r.created_at)}</td>
                  <td className={`${TD} text-right`}>
                    {canVerify ? (
                      <button
                        type="button"
                        onClick={() => onVerify(r.id)}
                        className={`rounded-full px-4 text-base font-semibold ${PILL_CLASSES.wait} border-2 border-wait`}
                      >
                        Verify
                      </button>
                    ) : (
                      <span className={`inline-block rounded-full px-3 py-1 text-base font-semibold ${PILL_CLASSES[status.tone]}`}>
                        {status.label}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TablePanel>
  )
}
