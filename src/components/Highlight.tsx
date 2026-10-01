// Wraps the first (or, with `suffix`, the last) case-insensitive occurrence
// of `query` in a <mark>. `query` is expected already uppercased.
export function Highlight({ text, query, suffix = false }: { text: string; query: string; suffix?: boolean }) {
  const i = query ? (suffix ? text.toUpperCase().lastIndexOf(query) : text.toUpperCase().indexOf(query)) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-brand/30 text-brand-dark rounded-sm">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}
