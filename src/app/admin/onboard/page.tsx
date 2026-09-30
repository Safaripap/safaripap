'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { SafaripapLogo } from '@/components/SafaripapLogo'
import { STEPS, type StepId } from '@/lib/onboarding-steps'

interface Sacco {
  id: string
  name: string
  vehicleCount: number
}

interface Result {
  vehicleCode: string
  saccoId: string
  saccoName: string
  lightningAddress: string
  walletName: string
  pin: string
  payUrl: string
  qrSvg: string
}

type StepState = { status: 'pending' | 'running' | 'done' | 'failed'; detail?: string }
type Phase = 'checking' | 'locked' | 'form' | 'running' | 'failed' | 'done'

const NEW_SACCO = '__new__'

const INPUT =
  'w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg text-brand-dark placeholder:text-brand-dark/60 focus:border-brand outline-none'
const LABEL = 'block text-base font-semibold text-brand-dark mb-1'
const HINT = 'mt-1 text-sm text-brand-dark/70'

const emptySteps = (): Record<StepId, StepState> =>
  Object.fromEntries(STEPS.map((s) => [s.id, { status: 'pending' }])) as Record<StepId, StepState>

export default function OnboardPage() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [configured, setConfigured] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [authError, setAuthError] = useState('')
  const [saccos, setSaccos] = useState<Sacco[] | null>(null)
  const [saccoChoice, setSaccoChoice] = useState('')
  const [newSaccoName, setNewSaccoName] = useState('')
  const [vehicleCode, setVehicleCode] = useState('')
  const [conductorName, setConductorName] = useState('')
  const [presetFare, setPresetFare] = useState('')
  const [formError, setFormError] = useState('')
  const [steps, setSteps] = useState(emptySteps)
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((s) => {
        setConfigured(s.configured)
        setPhase(s.signedIn ? 'form' : 'locked')
      })
      .catch(() => setPhase('locked'))
  }, [])

  useEffect(() => {
    if (phase !== 'form') return
    fetch('/api/admin/saccos')
      .then((r) => (r.ok ? r.json() : { saccos: [] }))
      .catch(() => ({ saccos: [] }))
      .then((d) => {
        setSaccos(d.saccos)
        setSaccoChoice((c) => c || d.saccos[0]?.id || NEW_SACCO)
      })
  }, [phase])

  // Move focus to each phase's heading so screen readers follow along.
  useEffect(() => {
    if (phase === 'done' || phase === 'failed') headingRef.current?.focus()
  }, [phase])

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAuthError(body.error || 'Could not sign in.')
      return
    }
    setPasscode('')
    setPhase('form')
  }

  async function onboard(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFailure('')
    setSteps(emptySteps())
    setPhase('running')

    const res = await fetch('/api/admin/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleCode,
        conductorName,
        presetFareKes: presetFare ? Number(presetFare) : null,
        saccoId: saccoChoice === NEW_SACCO ? null : saccoChoice,
        newSaccoName: saccoChoice === NEW_SACCO ? newSaccoName : null,
      }),
    }).catch(() => null)

    if (!res || !res.ok || !res.body) {
      const body = res ? await res.json().catch(() => ({})) : {}
      if (res?.status === 401) setPhase('locked')
      else {
        setFormError(body.error || 'Could not reach the server. Check your connection and try again.')
        setPhase('form')
      }
      return
    }

    // Read the newline-delimited progress events as they arrive.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finished = false
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines.filter(Boolean)) {
        const ev = JSON.parse(line)
        if (ev.type === 'step') {
          setSteps((s) => ({ ...s, [ev.step]: { status: ev.status, detail: ev.detail } }))
        } else if (ev.type === 'failed') {
          setSteps((s) => ({ ...s, [ev.step]: { status: 'failed' } }))
          setFailure(ev.error)
          setPhase('failed')
          finished = true
        } else if (ev.type === 'result') {
          setResult(ev)
          setPhase('done')
          finished = true
        }
      }
    }
    if (!finished) {
      setFailure('The connection dropped before onboarding finished. Check the vehicle list before trying again.')
      setPhase('failed')
    }
  }

  function startOver() {
    setVehicleCode('')
    setConductorName('')
    setPresetFare('')
    setNewSaccoName('')
    setResult(null)
    setSteps(emptySteps())
    setPhase('form')
  }

  async function copyAddress() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.lightningAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const plate = vehicleCode.toUpperCase().replace(/[^A-Z0-9]/g, '')

  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />

        {phase === 'checking' && <p role="status" className="text-brand-dark/70">Loading…</p>}

        {phase === 'locked' && (
          <form onSubmit={unlock} className="max-w-sm">
            <h1 className="font-display text-display-sm mb-2">Onboard a matatu</h1>
            <p className="text-lg text-brand-dark/70 mb-6">For Safaripap staff. Enter the admin passcode to continue.</p>
            {!configured && (
              <p role="alert" className="mb-4 rounded-xl bg-wait-light text-wait-ink p-4">
                Admin isn’t set up yet: add <code>ADMIN_PASSCODE</code> to the environment and restart the server.
              </p>
            )}
            <label htmlFor="passcode" className={LABEL}>
              Admin passcode
            </label>
            <input
              id="passcode"
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className={INPUT}
            />
            {authError && (
              <p role="alert" className="mt-2 text-red-700">
                {authError}
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
        )}

        {phase === 'form' && (
          <form onSubmit={onboard} className="max-w-lg space-y-5">
            <div>
              <h1 className="font-display text-display-sm mb-2">Onboard a matatu</h1>
              <p className="text-lg text-brand-dark/70">
                Creates the vehicle’s Lightning wallet and address, its QR sticker, and the conductor’s login.
              </p>
            </div>

            <div>
              <label htmlFor="sacco" className={LABEL}>
                Sacco
              </label>
              <select
                id="sacco"
                value={saccos ? saccoChoice : ''}
                onChange={(e) => setSaccoChoice(e.target.value)}
                disabled={!saccos}
                className={`${INPUT} disabled:opacity-60`}
              >
                {!saccos && <option value="">Loading saccos…</option>}
                {saccos?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.vehicleCount} {s.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                  </option>
                ))}
                {saccos && <option value={NEW_SACCO}>New sacco…</option>}
              </select>
            </div>

            {saccoChoice === NEW_SACCO && (
              <div>
                <label htmlFor="new-sacco" className={LABEL}>
                  New sacco name
                </label>
                <input
                  id="new-sacco"
                  value={newSaccoName}
                  onChange={(e) => setNewSaccoName(e.target.value)}
                  placeholder="e.g. Super Metro"
                  className={INPUT}
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="plate" className={LABEL}>
                Vehicle plate
              </label>
              <input
                id="plate"
                value={vehicleCode}
                onChange={(e) => setVehicleCode(e.target.value)}
                placeholder="KAB 123B"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className={`${INPUT} uppercase tabular-nums`}
                required
              />
              <p className={HINT}>Becomes the vehicle code passengers see, and its Lightning Address.</p>
            </div>

            <div>
              <label htmlFor="conductor" className={LABEL}>
                Conductor name
              </label>
              <input
                id="conductor"
                value={conductorName}
                onChange={(e) => setConductorName(e.target.value)}
                autoComplete="off"
                className={INPUT}
                required
              />
            </div>

            <div>
              <label htmlFor="fare" className={LABEL}>
                Preset fare <span className="font-normal text-brand-dark/70">(optional)</span>
              </label>
              <div className="flex items-center gap-3 rounded-xl border-2 border-brand-dark/15 bg-white px-4 focus-within:border-brand">
                <span aria-hidden="true" className="text-lg font-semibold text-brand-dark/70">
                  KES
                </span>
                <input
                  id="fare"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={10000}
                  value={presetFare}
                  onChange={(e) => setPresetFare(e.target.value)}
                  className="flex-1 min-w-0 min-h-[3.25rem] bg-transparent text-lg tabular-nums outline-none focus-visible:outline-none"
                />
              </div>
              <p className={HINT}>Pre-fills the pay screen. Leave empty if the fare changes by trip.</p>
            </div>

            {formError && (
              <p role="alert" className="text-red-700">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={!saccos}
              className="w-full rounded-2xl bg-brand text-white font-display font-bold text-xl px-4 disabled:opacity-40"
            >
              {plate ? `Onboard ${plate}` : 'Onboard vehicle'}
            </button>
          </form>
        )}

        {(phase === 'running' || phase === 'failed') && (
          <section className="max-w-lg" aria-labelledby="progress-heading">
            <h1 id="progress-heading" ref={headingRef} tabIndex={-1} className="font-display text-display-sm mb-6 focus:outline-none">
              {phase === 'failed' ? `Couldn’t onboard ${plate}` : `Onboarding ${plate}…`}
            </h1>
            <ol className="space-y-3" aria-live="polite">
              {STEPS.map((s) => (
                <StepRow key={s.id} label={s.label} state={steps[s.id]} />
              ))}
            </ol>
            {phase === 'failed' && (
              <div className="mt-6">
                <p role="alert" className="rounded-xl border-2 border-red-700/30 bg-white p-4 text-red-700">
                  {failure}
                </p>
                <p className="mt-2 text-brand-dark/70">
                  Anything created before the failure has been undone
                  {steps.wallet.status === 'done' &&
                    ' — except the empty LNbits wallet, which LNbits can’t delete through its API. You can remove it in the LNbits admin'}
                  .
                </p>
                <button
                  onClick={() => setPhase('form')}
                  className="mt-4 rounded-2xl bg-brand-dark text-cream font-display font-bold text-lg px-6"
                >
                  Back to the form
                </button>
              </div>
            )}
          </section>
        )}

        {phase === 'done' && result && (
          <section aria-labelledby="done-heading">
            <div className="flex items-center gap-3 mb-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-route">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    pathLength={1}
                    stroke="white"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="motion-check-draw"
                  />
                </svg>
              </span>
              <h1 id="done-heading" ref={headingRef} tabIndex={-1} className="font-display text-display-sm focus:outline-none">
                {result.vehicleCode} is ready
              </h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div id="sticker" className="ticket-stub text-center motion-fade-up">
                <div className="flex justify-center mb-4">
                  <SafaripapLogo />
                </div>
                <p className="text-xl font-semibold mb-4">Scan to pay your fare</p>
                <div
                  className="mx-auto w-full max-w-[16rem] [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label={`QR code linking to ${result.payUrl}`}
                  // Generated server-side by the qrcode library from our own URL.
                  dangerouslySetInnerHTML={{ __html: result.qrSvg }}
                />
                <div className="mt-4">
                  <span className="route-plate">{result.vehicleCode}</span>
                </div>
                <p className="mt-3 text-sm text-brand-dark/70 break-all">{result.payUrl}</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
                  <h2 className="text-base font-semibold text-brand-dark/70">Conductor PIN</h2>
                  <p className="font-display text-display-sm tabular-nums tracking-[0.15em]">{result.pin}</p>
                  <p className="mt-2 text-brand-dark/70">
                    Shown only once. Give it to the conductor now: they sign in at <strong>/login</strong> with{' '}
                    <strong>{result.vehicleCode}</strong> and this PIN.
                  </p>
                </div>

                <div className="rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
                  <h2 className="text-base font-semibold text-brand-dark/70">Lightning Address</h2>
                  <p className="text-lg font-semibold break-all">{result.lightningAddress}</p>
                  <p className="mt-1 text-brand-dark/70">
                    Wallet “{result.walletName}” in LNbits · Sacco {result.saccoName}
                  </p>
                  <button
                    onClick={copyAddress}
                    className="mt-3 rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold"
                  >
                    {copied ? 'Copied' : 'Copy address'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => window.print()}
                    className="rounded-xl bg-brand-dark text-cream text-base font-semibold px-3"
                  >
                    Print sticker
                  </button>
                  <Link
                    href={`/pay/${result.vehicleCode}`}
                    className="flex min-h-[3.25rem] items-center justify-center rounded-xl border-2 border-brand-dark/15 bg-white text-base font-semibold px-3 text-center"
                  >
                    Open pay screen
                  </Link>
                  <Link
                    href={`/sacco/${result.saccoId}`}
                    className="flex min-h-[3.25rem] items-center justify-center rounded-xl border-2 border-brand-dark/15 bg-white text-base font-semibold px-3 text-center"
                  >
                    Sacco totals
                  </Link>
                  <button
                    onClick={startOver}
                    className="rounded-xl border-2 border-brand-dark/15 bg-white text-base font-semibold px-3"
                  >
                    Onboard another
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function StepRow({ label, state }: { label: string; state: StepState }) {
  const text = {
    pending: 'text-brand-dark/60',
    running: 'text-brand-dark',
    done: 'text-brand-dark',
    failed: 'text-red-700',
  }[state.status]
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
        {state.status === 'pending' && <span className="h-5 w-5 rounded-full border-2 border-brand-dark/30" />}
        {state.status === 'running' && (
          <span className="h-5 w-5 rounded-full border-2 border-wait border-t-transparent animate-spin" />
        )}
        {state.status === 'done' && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-route">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                pathLength={1}
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="motion-check-draw"
              />
            </svg>
          </span>
        )}
        {state.status === 'failed' && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
              <path d="M7 7l10 10M17 7 7 17" />
            </svg>
          </span>
        )}
      </span>
      <span className={text}>
        <span className="text-lg font-semibold">
          {label}
          <span className="sr-only">
            {state.status === 'done' ? ' — done' : state.status === 'running' ? ' — in progress' : state.status === 'failed' ? ' — failed' : ''}
          </span>
        </span>
        {state.detail && <span className="block text-base text-brand-dark/70 break-all">{state.detail}</span>}
      </span>
    </li>
  )
}
