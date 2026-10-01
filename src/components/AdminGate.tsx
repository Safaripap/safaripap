'use client'

import { useEffect, useState } from 'react'

// Shows the admin passcode form until the admin session cookie is set, then
// renders the page. `lock()` from the render prop sends a page back here
// when an API call answers 401 (session expired).
export function AdminGate({ title, children }: { title: string; children: (lock: () => void) => React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking')
  const [configured, setConfigured] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((s) => {
        setConfigured(s.configured)
        setState(s.signedIn ? 'open' : 'locked')
      })
      .catch(() => setState('locked'))
  }, [])

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return setError(body.error || 'Could not sign in.')
    setPasscode('')
    setState('open')
  }

  if (state === 'checking') return <p role="status" className="text-brand-dark/70">Loading…</p>
  if (state === 'open') return <>{children(() => setState('locked'))}</>

  return (
    <form onSubmit={unlock} className="max-w-sm">
      <h1 className="font-display text-display-sm mb-2">{title}</h1>
      <p className="text-lg text-brand-dark/70 mb-6">For Safaripap staff. Enter the admin passcode to continue.</p>
      {!configured && (
        <p role="alert" className="mb-4 rounded-xl bg-wait-light text-wait-ink p-4">
          Admin isn’t set up yet: add <code>ADMIN_PASSCODE</code> to the environment and restart the server.
        </p>
      )}
      <label htmlFor="passcode" className="block text-base font-semibold text-brand-dark mb-1">
        Admin passcode
      </label>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg text-brand-dark focus:border-brand outline-none"
      />
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!passcode}
        className="mt-4 w-full rounded-2xl bg-brand-dark text-cream font-display font-bold text-xl disabled:opacity-40"
      >
        Unlock
      </button>
    </form>
  )
}
