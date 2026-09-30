import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'

// One "Sign in" for the landing page header: conductors and sacco people sign
// in differently (vehicle code vs phone number), so let them pick.
const OPTIONS = [
  {
    href: '/login',
    title: 'I’m a conductor',
    body: 'See fares on your matatu as they’re paid. Sign in with your vehicle code and PIN.',
  },
  {
    href: '/manage/login',
    title: 'I manage a sacco or own a matatu',
    body: 'See totals by day and by matatu. Sign in with your phone number and PIN.',
  },
]

export default function SignInChooserPage() {
  return (
    <main className="min-h-screen px-6 pt-8 pb-10">
      <div className="mx-auto max-w-md">
        <AppHeader />
        <h1 className="font-display text-display-sm mb-8">Sign in</h1>
        <ul className="space-y-3">
          {OPTIONS.map((o) => (
            <li key={o.href}>
              <Link
                href={o.href}
                className="flex items-center justify-between gap-4 rounded-2xl border-2 border-brand-dark/15 bg-white p-5"
              >
                <span>
                  <span className="block text-xl font-semibold">{o.title}</span>
                  <span className="mt-1 block text-brand-dark/70">{o.body}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-brand-dark/70">
          Paying a fare? You don’t need to sign in.{' '}
          <Link href="/pay" className="font-semibold text-brand-dark underline underline-offset-4">
            Pay a fare
          </Link>
        </p>
      </div>
    </main>
  )
}
