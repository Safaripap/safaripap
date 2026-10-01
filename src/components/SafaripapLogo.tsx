// The Safaripap logo: the matatu-and-lightning mark (public/logo.svg) with the
// name beside it as live text, so it stays crisp and screen readers read it.
// The mark is wider than it is tall, so it's sized by height.
export function SafaripapLogo({ size = 'md', wordmark = true }: { size?: 'sm' | 'md' | 'lg'; wordmark?: boolean }) {
  const mark = { sm: 'h-8', md: 'h-10', lg: 'h-16' }[size]
  const text = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' }[size]
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG; next/image adds nothing here */}
      <img src="/logo.svg" alt={wordmark ? '' : 'Safaripap'} className={`${mark} w-auto shrink-0`} />
      {wordmark && (
        <span className={`font-display font-extrabold tracking-tight leading-none text-brand-dark ${text}`}>Safaripap</span>
      )}
    </span>
  )
}
