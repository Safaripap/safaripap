// PLACEHOLDER LOGO — swap the <svg> below for the real Safaripap mark when
// it's ready (keep the viewBox square). The wordmark is live text so it stays
// crisp and screen readers read the name.
export function SafaripapLogo({ size = 'md', wordmark = true }: { size?: 'sm' | 'md' | 'lg'; wordmark?: boolean }) {
  const mark = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' }[size]
  const text = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' }[size]
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className={mark} aria-hidden={wordmark} role={wordmark ? undefined : 'img'} aria-label={wordmark ? undefined : 'Safaripap'}>
        <rect width="32" height="32" rx="8" fill="#f7931a" />
        <path d="M18.5 5 9 18h6.5L13.5 27 23 14h-6.5L18.5 5Z" fill="#1a1a2e" />
      </svg>
      {wordmark && (
        <span className={`font-display font-extrabold tracking-tight leading-none text-brand-dark ${text}`}>Safaripap</span>
      )}
    </span>
  )
}
