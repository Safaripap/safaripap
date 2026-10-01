import Link from 'next/link'
import VehicleCodeForm from './components/VehicleCodeForm'


const problems = [
  {
    title: 'Your phone is on show',
    body: 'To prove you paid, you hold up your screen. The conductor, and everyone beside you, can see your balance and your contacts.',
  },
  {
    title: 'Every fare is checked by hand',
    body: 'One passenger at a time, while the vehicle fills and moves. Boarding slows down and disputes start.',
  },
  {
    title: 'A message on a screen proves little',
    body: 'It is easy to fake, and the conductor has no way to tell whether the money actually arrived.',
  },
]


const steps = [
  {
    title: 'Scan the code in the vehicle',
    body: 'Or dial the USSD code from any phone, including feature phones with no internet.',
  },
  {
    title: 'Pay with M-Pesa',
    body: 'Enter the fare and your number, then approve on your own phone. Your PIN stays on Safaricom’s prompt and never touches Safaripap.',
  },
  {
    title: 'The conductor sees it land',
    body: 'The fare appears on their dashboard as soon as the payment is confirmed. Nobody needs to see your phone.',
  },
]


export default function HomePage() {
  return (
    <main className="min-h-dvh bg-cream text-brand-dark">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6">
        <span className="route-plate">SAFARIPAP</span>
        <Link
          href="/login"
          className="rounded-xl px-3 py-2 text-lg font-medium underline underline-offset-4"
        >
          Conductor sign in
        </Link>
      </header>


      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-20 pt-14 md:grid-cols-2 md:pt-20">
        <div>
          <h1 className="font-display text-5xl leading-[0.95] md:text-7xl">
            Pay your matatu fare without handing over your phone
          </h1>
          <p className="mt-6 max-w-md text-xl leading-relaxed text-brand-dark/75">
            Scan the code in the vehicle and pay with M-Pesa from your own phone. The fare lands on the
            conductor’s screen straight away.
          </p>
          <div className="mt-8">
            <VehicleCodeForm />
          </div>
        </div>


        <div aria-hidden="true" className="mx-auto w-full max-w-sm">
          <div className="rounded-[2rem] bg-brand-dark p-5 text-cream shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full bg-cream px-3 py-1 font-display text-lg tracking-wide text-brand-dark">
                KAB123B
              </span>
              <span className="text-sm text-cream/70">Conductor view</span>
            </div>
            <div className="rounded-xl border-2 border-route/60 bg-route-light p-4 text-brand-dark">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl">KES 50</span>
                <span className="flex items-center gap-2 text-lg font-semibold">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-route" />
                  Paid
                </span>
              </div>
              <p className="mt-1 text-base text-brand-dark/70">Phone …456 · Receipt …M2P</p>
            </div>
            <div className="mt-2 rounded-xl border-2 border-cream/15 p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-cream/60">KES 50</span>
                <span className="text-lg text-cream/60">Waiting</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="max-w-2xl font-display text-4xl leading-none md:text-5xl">
            Paying by phone should not put you at risk
          </h2>
          <ul className="mt-10 grid gap-0 divide-y divide-brand-dark/15 border-y border-brand-dark/15 md:grid-cols-3 md:divide-x md:divide-y-0">
            {problems.map((p) => (
              <li key={p.title} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                <h3 className="text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-brand-dark/75">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>


      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-display text-4xl leading-none md:text-5xl">How it works</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand font-display text-2xl text-brand-dark">
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-lg leading-relaxed text-brand-dark/75">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>


      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl bg-route-light p-8 md:p-12">
          <h2 className="max-w-2xl font-display text-4xl leading-none md:text-5xl">
            Every vehicle gets its own wallet
          </h2>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-brand-dark/80">
            Behind the M-Pesa payment, each fare settles as Bitcoin over the Lightning Network straight into
            that vehicle’s own wallet, with no shared till in between. Every successful payment also leaves a
            public receipt on Nostr, so owners and SACCOs can check what each matatu earned.
          </p>
        </div>
      </section>


      <footer className="bg-brand-dark text-cream">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
          <div>
            <p className="font-display text-3xl">Work on a matatu?</p>
            <p className="mt-1 text-lg text-cream/75">Sign in to see your fares arrive live.</p>
          </div>
          <Link
            href="/login"
            className="rounded-2xl bg-brand px-6 py-3 font-display text-2xl tracking-wide text-brand-dark"
          >
            Conductor sign in
          </Link>
        </div>
        <p className="mx-auto max-w-5xl px-6 pb-8 text-base text-cream/60">
          Built for Hack4Freedom by the Safaripap team.
        </p>
      </footer>
    </main>
  )
}