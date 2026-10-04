import Link from 'next/link'

// Persistent bottom navigation for the conductor's screens. Real links, so
// keyboard, screen readers and the back button all behave normally. Each
// screen passes along the vehicle code so the other screen isn't a dead end.
// Conductors only ever see their own vehicle: there is no sacco-wide view here.
type Section = 'fares' | 'prompt'

export function ConductorNav({ active, vehicleCode }: { active: Section; vehicleCode?: string | null }) {
  const items: { id: Section; label: string; href: string | null; icon: JSX.Element }[] = [
    {
      id: 'fares',
      label: 'Fares',
      href: vehicleCode ? `/dashboard/${vehicleCode}` : null,
      icon: <path d="M4 6h16M4 12h16M4 18h10" />,
    },
    {
      id: 'prompt',
      label: 'Prompt passenger',
      href: vehicleCode ? `/pay/${vehicleCode}?from=conductor` : null,
      icon: (
        <>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 17h2" />
        </>
      ),
    },
  ]

  return (
    <nav
      aria-label="Conductor"
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-brand-dark/10 bg-cream pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl gap-2 px-2 py-2">
        {items.map((item) => {
          const isActive = item.id === active
          const content = (
            <>
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              <span className="text-sm font-semibold leading-tight text-center">{item.label}</span>
            </>
          )
          const base = 'flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1'
          return (
            <li key={item.id} className="flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${base} ${isActive ? 'bg-brand-dark text-cream' : 'text-brand-dark/70'}`}
                >
                  {content}
                </Link>
              ) : (
                // No vehicle known for this link yet — show it, but don't
                // pretend it goes somewhere.
                <span aria-disabled="true" className={`${base} text-brand-dark/40`}>
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
