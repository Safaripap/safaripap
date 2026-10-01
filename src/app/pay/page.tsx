'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { getRecentVehicles } from '@/lib/recent-vehicles'

// For passengers who didn't scan the QR sticker — e.g. they opened the
// installed app. They type the vehicle code printed under the QR (and on the
// route plate), we check it exists, then send them to that vehicle's pay page.
export default function EnterVehicleCodePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => setRecent(getRecentVehicles()), [])

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!normalized) return
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicles/${normalized}`)
      if (res.status === 404) {
        setError(`No matatu is registered as ${normalized}. Check the code on the sticker and try again.`)
        return
      }
      if (!res.ok) throw new Error()
      router.push(`/pay/${normalized}`)
    } catch {
      setError("Couldn't check that code. Check your connection and try again.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 pt-8 pb-10">
      <AppHeader />

      <div className="flex-1 flex flex-col items-center justify-center">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="font-display text-display-sm mb-2">Which matatu?</h1>
          <p className="text-lg text-brand-dark/70 mb-8">
            Enter the vehicle code. It’s printed under the QR code inside the matatu.
          </p>

          <label htmlFor="vehicle-code" className="block text-base font-semibold text-brand-dark mb-2">
            Vehicle code
          </label>
          <input
            id="vehicle-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError('')
            }}
            placeholder="KAB 123B"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!error}
            aria-describedby={error ? 'code-error' : undefined}
            className="w-full font-display text-4xl font-bold uppercase tabular-nums tracking-wide bg-transparent border-b-4 border-brand-dark/15 py-3 mb-3 focus:border-brand outline-none placeholder:text-brand-dark/50"
          />
          {error ? (
            <p id="code-error" role="alert" className="text-red-700 mb-6">
              {error}
            </p>
          ) : (
            <div className="mb-6" />
          )}

          <button
            type="submit"
            disabled={!normalized || checking}
            className="w-full bg-brand text-white font-display font-bold text-2xl rounded-2xl py-4 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {checking ? 'Checking…' : 'Continue'}
          </button>

          {recent.length > 0 && (
            <section className="mt-10" aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="text-base font-semibold text-brand-dark mb-3">
                Your recent matatus
              </h2>
              <ul className="flex flex-wrap gap-2">
                {recent.map((c) => (
                  <li key={c}>
                    <Link
                      href={`/pay/${c}`}
                      className="route-plate min-h-[3.25rem] px-5"
                      aria-label={`Pay on ${c}`}
                    >
                      {c}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-10 text-brand-dark/70">
            Have the QR code in front of you? Point your phone’s camera at it instead.
          </p>
        </form>
      </div>
    </main>
  )
}
