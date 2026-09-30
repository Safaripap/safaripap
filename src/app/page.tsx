import Image from 'next/image'
import Link from 'next/link'
import { SafaripapLogo } from '@/components/SafaripapLogo'
import { SettingsMenu } from '@/components/SettingsMenu'
import matatu from '../../public/images/matatu-mombasa.jpg'
import street from '../../public/images/nairobi-street.jpg'
import passenger from '../../public/images/passenger-phone.jpg'

// Landing page — also the installed app's start screen. Passengers first:
// the one big action is "Pay a fare". Saccos and conductors get their own
// section below.
export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6">
        <header className="flex items-center justify-between gap-3 py-6">
          <SafaripapLogo size="sm" />
          <div className="flex items-center gap-2">
            <Link
              href="/signin"
              className="inline-flex min-h-[3.25rem] items-center rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold text-brand-dark"
            >
              Sign in
            </Link>
            <SettingsMenu />
          </div>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 pb-16 pt-4 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-10">
          <div>
            <h1 className="font-display text-display text-balance">Pay your matatu fare in seconds.</h1>
            <p className="mt-5 max-w-xl text-xl text-brand-dark/70">
              Use M-Pesa like you always do. Scan the QR code in the matatu or type its code, and the conductor
              sees your fare the moment it lands.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/pay"
                className="inline-flex min-h-[3.5rem] items-center rounded-2xl bg-brand px-8 font-display text-2xl font-bold text-white"
              >
                Pay a fare
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-[3.5rem] items-center rounded-2xl px-5 text-lg font-semibold text-brand-dark underline decoration-2 underline-offset-4"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="relative">
            <Image
              src={matatu}
              alt="A colourful graffiti-painted matatu parked on a street in Mombasa, a man in a blue kanzu walking past"
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
            {/* The real receipt from the pay screen, as an example. */}
            <div
              aria-label="Example receipt"
              className="ticket-stub no-notch !absolute -bottom-8 left-4 right-4 sm:left-auto sm:right-6 sm:w-72 !py-5 !px-5"
            >
              <p className="font-display text-2xl font-bold">KES 60 paid</p>
              <p className="mt-2 border-t border-dashed border-brand-dark/15 pt-2 text-base text-brand-dark">
                Tell the conductor: phone ending <strong className="font-display tabular-nums">482</strong>, receipt ending{' '}
                <strong className="font-display tabular-nums">9F3</strong>
              </p>
            </div>
          </div>
        </section>

        {/* How it works — passengers */}
        <section id="how" className="scroll-mt-6 grid items-center gap-10 py-16 md:grid-cols-[1fr_1.1fr] md:py-24">
          <Image
            src={passenger}
            alt="A young woman in Nairobi holding her phone"
            sizes="(min-width: 768px) 45vw, 100vw"
            className="order-last aspect-[4/3] w-full rounded-2xl object-cover object-[50%_35%] md:order-first"
          />
          <div>
            <h2 className="font-display text-display-sm">Three steps, no cash, no change</h2>
            <ol className="mt-8 space-y-7">
              {[
                {
                  title: 'Find the matatu',
                  body: 'Scan the QR code inside, or tap Pay a fare and type the vehicle code printed under it.',
                },
                {
                  title: 'Pay with M-Pesa',
                  body: 'Enter the fare and your number. Approve the M-Pesa prompt on your phone with your PIN, as usual.',
                },
                {
                  title: 'Tell the conductor',
                  body: 'Your phone shows a receipt. Say the endings out loud and the conductor matches them on their screen.',
                },
              ].map((step, i) => (
                <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-dark font-display text-xl font-bold text-cream"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="mt-1 text-lg text-brand-dark/70">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/pay"
              className="mt-10 inline-flex min-h-[3.5rem] items-center rounded-2xl bg-brand px-8 font-display text-xl font-bold text-white"
            >
              Pay a fare
            </Link>
          </div>
        </section>
      </div>

      {/* Saccos & conductors */}
      <section className="bg-brand-dark text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <h2 className="font-display text-display-sm text-balance">For saccos and conductors</h2>
            <p className="mt-4 text-xl text-cream/80">
              Every fare is accounted for, the moment it’s paid.
            </p>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="text-xl font-semibold">Fares show up live on the conductor’s phone</dt>
                <dd className="mt-1 text-lg text-cream/80">
                  With a chime, the passenger’s phone and receipt endings, and one tap to verify. No screenshots to
                  squint at.
                </dd>
              </div>
              <div>
                <dt className="text-xl font-semibold">Money lands in the vehicle’s own wallet, instantly</dt>
                <dd className="mt-1 text-lg text-cream/80">
                  Each matatu gets its own Lightning wallet. Payments settle in seconds, not at the end of the day.
                </dd>
              </div>
              <div>
                <dt className="text-xl font-semibold">Sacco totals you can trust</dt>
                <dd className="mt-1 text-lg text-cream/80">
                  A live total per vehicle, and a public, signed receipt for every fare.
                </dd>
              </div>
            </dl>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[3.5rem] items-center rounded-2xl bg-cream px-6 font-display text-xl font-bold text-brand-dark"
              >
                Conductor sign in
              </Link>
              <Link
                href="/manage/login"
                className="inline-flex min-h-[3.5rem] items-center rounded-2xl border-2 border-cream/40 px-6 font-display text-xl font-bold text-cream"
              >
                Sacco sign in
              </Link>
            </div>
          </div>
          <Image
            src={street}
            alt="Matatus and cars in traffic on a busy Nairobi street lined with shops"
            sizes="(min-width: 768px) 45vw, 100vw"
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <SafaripapLogo size="sm" />
            <p className="mt-3 text-lg text-brand-dark/70">
              Matatu fares with M-Pesa, settled instantly over Bitcoin’s Lightning Network.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="-mx-3 flex flex-wrap gap-x-2 gap-y-2 md:justify-end">
              {[
                { href: '/pay', label: 'Pay a fare' },
                { href: '#how', label: 'How it works' },
                { href: '/login', label: 'Conductor sign in' },
                { href: '/manage/login', label: 'Sacco sign in' },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-[3.25rem] items-center rounded-xl px-3 text-base font-semibold text-brand-dark underline-offset-4 hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 space-y-1 border-t-2 border-brand-dark/10 pt-6 text-sm text-brand-dark/70">
          <p>Payments by Bitika · Built for Hack4Freedom 2026</p>
          <p>
            M-Pesa is a trademark of Safaricom PLC; Safaripap is not affiliated with Safaricom. Photos from Pexels by
            Volker Morr, JimmyJimmy and benedict buston.
          </p>
        </div>
      </footer>
    </main>
  )
}
