import Link from 'next/link'

// Tabs across the admin screens. Real links, current one marked.
export function AdminNav({ active }: { active: 'onboard' | 'people' | 'demo' }) {
  const items = [
    { id: 'onboard', label: 'Onboard a matatu', href: '/admin/onboard' },
    { id: 'people', label: 'Managers & owners', href: '/admin/people' },
    { id: 'demo', label: 'Demo data', href: '/admin/demo' },
  ] as const
  return (
    <nav aria-label="Admin" className="mb-8">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.id === active ? 'page' : undefined}
              className={`inline-flex min-h-[3.25rem] items-center rounded-xl px-4 text-base font-semibold ${
                item.id === active ? 'bg-brand-dark text-cream' : 'border-2 border-brand-dark/15 bg-white text-brand-dark'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
