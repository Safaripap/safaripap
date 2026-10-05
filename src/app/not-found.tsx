import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'

// Any unknown address: say so, and offer the ways forward. After Nauli Sacco's.
export default function NotFound() {
  return (
    <main className="min-h-screen px-6 pt-8 pb-10">
      <div className="mx-auto max-w-md">
        <AppHeader back={{ href: '/', label: 'Home' }} />
        <h1 className="font-display text-display-sm mb-2">Page not found</h1>
        <p className="text-lg text-brand-dark/70 mb-8">That link doesn’t go anywhere. Here’s where you can go instead.</p>
        <ul className="space-y-3">
          {[
            { href: '/pay', label: 'Pay a fare', hint: 'Enter the code on the matatu’s sticker' },
            { href: '/signin', label: 'Sign in', hint: 'Conductors, sacco managers and owners' },
            { href: '/', label: 'Safaripap home', hint: 'What Safaripap is and how it works' },
          ].map((o) => (
            <li key={o.href}>
              <Link href={o.href} className="block rounded-2xl border-2 border-brand-dark/15 bg-white p-5">
                <span className="block font-display text-xl font-bold">{o.label}</span>
                <span className="block text-base text-brand-dark/70">{o.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
