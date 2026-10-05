// Table styling ported from Nauli Sacco's SACCO and forecast tables: a
// bordered panel with a heading bar, small uppercase column heads, ruled
// rows and tabular figures. Colours and fonts are Safaripap's own tokens
// (brand-dark ink, cream bar, Montserrat headings), not Nauli's theme.

export const TABLE = 'w-full text-left text-base tabular-nums'
export const THEAD = 'text-xs uppercase tracking-wider text-brand-dark/70'
export const TH = 'px-3 py-2 font-semibold sm:px-4'
export const ROW = 'border-t border-brand-dark/10'
export const TD = 'px-3 py-3 sm:px-4'

export function TablePanel({
  title,
  headingId,
  aside,
  children,
}: {
  title?: string
  headingId?: string
  aside?: React.ReactNode // e.g. a total, on the right of the heading bar
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-brand-dark bg-white">
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b-2 border-brand-dark bg-cream px-4 py-3">
          <h2 id={headingId} className="font-display text-xl font-extrabold uppercase tracking-tight">
            {title}
          </h2>
          {aside && <p className="text-base font-bold tabular-nums">{aside}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
