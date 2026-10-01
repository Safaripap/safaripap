'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { JOIN_LIMITS, parsePlates, validateJoin } from '@/lib/join'
import type { MemberRole } from '@/lib/member-login'
import { formatLocalKenyanNumber, isValidKenyanMobile, toLocalKenyanNumber } from '@/lib/phone'

const INPUT =
  'w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg text-brand-dark placeholder:text-brand-dark/60 focus:border-brand outline-none'
const LABEL = 'block text-base font-semibold text-brand-dark mb-1'
const HINT = 'mt-1 text-sm text-brand-dark/70'

// Saccos and matatu owners ask to join. Nothing is created here: Safaripap
// staff review the request and set up wallets and logins themselves.
export default function JoinPage() {
  const [role, setRole] = useState<MemberRole>('manager')
  const [saccoName, setSaccoName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('') // the 9 digits after +254
  const [matatuCount, setMatatuCount] = useState('')
  const [plates, setPlates] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // hidden trap for bots
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const doneRef = useRef<HTMLHeadingElement>(null)

  const input = { saccoName, contactName, phone, role, matatuCount: Number(matatuCount), plates, notes }
  const plateList = parsePlates(plates)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validateJoin(input)
    if (invalid) return setError(invalid)
    setError('')
    setSending(true)
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, website }),
    }).catch(() => null)
    setSending(false)
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setError(body?.error || 'Couldn’t send your request. Check your connection and try again.')
    setSent(true)
    requestAnimationFrame(() => doneRef.current?.focus())
  }

  return (
    <main className="min-h-screen px-6 pt-8 pb-16">
      <div className="mx-auto max-w-lg">
        <AppHeader />

        {sent ? (
          <section aria-labelledby="sent-heading">
            <h1 ref={doneRef} id="sent-heading" tabIndex={-1} className="font-display text-display-sm mb-3 focus:outline-none">
              Thanks, {contactName.trim().split(' ')[0]}. We’ve got your request.
            </h1>
            <p className="text-lg text-brand-dark/70 mb-6">
              We’ll call you on <strong className="text-brand-dark tabular-nums">0{formatLocalKenyanNumber(phone)}</strong> to
              set up {saccoName.trim()}. Each matatu gets its own wallet, a QR sticker and a conductor login, and you get a
              sign-in to see your fare totals.
            </p>
            <Link
              href="/"
              className="inline-flex min-h-[3.25rem] items-center rounded-2xl bg-brand-dark px-6 font-display font-bold text-lg text-cream"
            >
              Back to Safaripap
            </Link>
          </section>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <h1 className="font-display text-display-sm mb-2">Bring your sacco to Safaripap</h1>
              <p className="text-lg text-brand-dark/70">
                Tell us about your sacco or matatus. We’ll call you to set everything up: a wallet and QR sticker for each
                matatu, conductor logins, and fare totals for you.
              </p>
            </div>

            <fieldset>
              <legend className={LABEL}>I am</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['manager', 'owner'] as const).map((r) => (
                  <label
                    key={r}
                    className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${
                      role === r ? 'border-brand-dark bg-white' : 'border-brand-dark/15'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="h-5 w-5 accent-brand-dark"
                    />
                    <span className="font-semibold">{r === 'manager' ? 'A sacco manager' : 'A matatu owner'}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="sacco-name" className={LABEL}>
                Sacco name
              </label>
              <input
                id="sacco-name"
                value={saccoName}
                onChange={(e) => setSaccoName(e.target.value)}
                maxLength={JOIN_LIMITS.text}
                autoComplete="organization"
                placeholder="e.g. Super Metro"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="contact-name" className={LABEL}>
                Your name
              </label>
              <input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                maxLength={JOIN_LIMITS.text}
                autoComplete="name"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="join-phone" className={LABEL}>
                Phone number
              </label>
              <div className="flex items-center gap-3 rounded-xl border-2 border-brand-dark/15 bg-white px-4 focus-within:border-brand">
                <span aria-hidden="true" className="text-lg font-semibold tabular-nums text-brand-dark/70">
                  +254
                </span>
                <input
                  id="join-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={formatLocalKenyanNumber(phone)}
                  onChange={(e) => setPhone(toLocalKenyanNumber(e.target.value))}
                  placeholder="712 345 678"
                  aria-describedby="join-phone-hint"
                  className="flex-1 min-w-0 min-h-[3.25rem] bg-transparent text-lg tabular-nums outline-none focus-visible:outline-none placeholder:text-brand-dark/60"
                />
              </div>
              <p id="join-phone-hint" className={HINT}>
                {phone.length === 9 && !isValidKenyanMobile(phone)
                  ? 'That doesn’t look like a Kenyan mobile number. It should start with 7 or 1.'
                  : 'We’ll call this number. It also becomes your sign-in.'}
              </p>
            </div>

            <div>
              <label htmlFor="matatu-count" className={LABEL}>
                How many matatus?
              </label>
              <input
                id="matatu-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={JOIN_LIMITS.matatus}
                value={matatuCount}
                onChange={(e) => setMatatuCount(e.target.value)}
                className={`${INPUT} max-w-[10rem] tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="plates" className={LABEL}>
                Number plates <span className="font-normal text-brand-dark/70">(optional)</span>
              </label>
              <textarea
                id="plates"
                value={plates}
                onChange={(e) => setPlates(e.target.value)}
                rows={3}
                placeholder="KAB 123B, KCD 456E"
                aria-describedby="plates-hint"
                className={`${INPUT} py-3 uppercase tabular-nums`}
              />
              <p id="plates-hint" className={HINT}>
                {plateList.length > 0
                  ? `${plateList.length} ${plateList.length === 1 ? 'plate' : 'plates'}: ${plateList.join(', ')}`
                  : 'Separate them with commas or new lines. It speeds up setup.'}
              </p>
            </div>

            <div>
              <label htmlFor="notes" className={LABEL}>
                Anything else? <span className="font-normal text-brand-dark/70">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={JOIN_LIMITS.notes}
                placeholder="Routes, a good time to call…"
                className={`${INPUT} py-3`}
              />
            </div>

            {/* Hidden from people (and screen readers); bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-2xl bg-brand text-white font-display font-bold text-xl px-4 disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send request'}
            </button>
            <p className="text-center text-brand-dark/70">
              Already set up?{' '}
              <Link href="/signin" className="font-semibold text-brand-dark underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

