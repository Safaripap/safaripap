import Link from 'next/link'

// One tab bar for the manager/owner views, so Forecast reads as part of the
// same dashboard. Ported from Nauli Sacco's SaccoTabs.
type Tab = 'takings' | 'forecast'

export function ManageTabs({ active }: { active: Tab }) {
  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: 'takings', label: 'Takings', href: '/manage' },
    { id: 'forecast', label: 'Forecast', href: '/manage/forecast' },
  ]
  return (
    <nav aria-label="Dashboard" className="mb-8 border-b-2 border-brand-dark">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const isActive = t.id === active
          return (
            <li key={t.id} className="flex-1 sm:flex-none">
              <Link
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-12 items-center justify-center px-4 text-base font-bold transition-colors duration-150 ${
                  isActive ? 'text-brand-dark' : 'text-brand-dark/70 hover:text-brand-dark'
                }`}
              >
                {t.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 -bottom-[2px] h-1 rounded-t-full ${isActive ? 'bg-brand-dark' : 'bg-transparent'}`}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
