'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConductorNav } from '@/components/ConductorNav'
import { AppHeader } from '@/components/AppHeader'
import Link from 'next/link'
import { formatLocalKenyanNumber, isValidKenyanMobile, toLocalKenyanNumber } from '@/lib/phone'
import { rememberVehicle } from '@/lib/recent-vehicles'

type Screen = 'loading' | 'notFound' | 'amount' | 'phone' | 'waiting' | 'success' | 'error'

const POLL_TIMEOUT_MS = 3 * 60 * 1000
// Daraja sandbox callbacks often never arrive: ask M-Pesa once by ourselves.
const AUTO_QUERY_AFTER_MS = 30_000

interface Vehicle {
  vehicle_code: string
  preset_fare_kes: number | null
}

export default function PayPage({
  params,
  searchParams,
}: {
  params: { vehicleCode: string }
  searchParams: { from?: string; sacco?: string }
}) {
  // Passengers arrive from the QR sticker and see no nav. A conductor who
  // opened this from the dashboard to prompt a passenger gets the nav back.
  const fromConductor = searchParams.from === 'conductor'
  const [screen, setScreen] = useState<Screen>('loading')
  const [amount, setAmount] = useState<number | ''>('')
  // The 9 digits after +254, e.g. "712345678".
  const [phone, setPhone] = useState('')
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ mpesa_receipt: string; phone_last3: string; receipt_last3: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Once the passenger has moved past the first screen, each new screen's
  // heading takes focus, so VoiceOver/TalkBack users hear where they are
  // instead of being left on content that has gone.
  const navigated = useRef(false)
  // Stable identity matters: React re-runs a ref callback whenever it's a new
  // function, which would steal focus back from the input on every keystroke.
  const focusHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el && navigated.current) el.focus()
  }, [])
  function goTo(next: Screen) {
    navigated.current = true
    setScreen(next)
  }
  const code = params.vehicleCode.toUpperCase()

  useEffect(() => {
    fetch(`/api/vehicles/${params.vehicleCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Vehicle | null) => {
        if (!v) {
          setScreen('notFound')
          return
        }
        if (v.preset_fare_kes) setAmount(v.preset_fare_kes)
        rememberVehicle(v.vehicle_code)
        setScreen('amount')
      })
      .catch(() => setScreen('notFound'))
  }, [params.vehicleCode])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function submitPay() {
    goTo('waiting')
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleCode: params.vehicleCode, amountKes: amount, phone: `254${phone}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed to start')

      setTransactionCode(data.transactionCode)

      // Bitika reports failure as 'failed' (M-Pesa declined or cancelled) or
      // 'payment_failed' (the Lightning payout failed); a Daraja-fallback fare
      // reports 'failed'. Stop waiting after a
      // few minutes so a lost confirmation never leaves the passenger stuck.
      const startedAt = Date.now()
      let queried = false
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          clearInterval(pollRef.current!)
          setErrorMsg(
            'We didn’t get a confirmation in time. If M-Pesa took the money, show the conductor your M-Pesa message. Otherwise, try again.'
          )
          setScreen('error')
          return
        }
        if (data.provider === 'daraja' && !queried && Date.now() - startedAt > AUTO_QUERY_AFTER_MS) {
          queried = true
          await fetch(`/api/transactions/${data.transactionCode}/query`, { method: 'POST' }).catch(() => undefined)
        }
        const statusRes = await fetch(`/api/transactions/${data.transactionCode}`)
        if (!statusRes.ok) return
        const statusData = await statusRes.json()
        if (statusData.status === 'fulfilled') {
          clearInterval(pollRef.current!)
          setReceipt(statusData)
          setScreen('success')
        } else if (statusData.status === 'failed' || statusData.status === 'payment_failed') {
          clearInterval(pollRef.current!)
          setErrorMsg('Payment did not go through. Please try again.')
          setScreen('error')
        }
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.')
      setScreen('error')
    }
  }

  return (
    <main className={`min-h-screen flex flex-col px-6 pt-8 ${fromConductor ? 'pb-32' : 'pb-10'}`}>
      <AppHeader plate={screen !== 'loading' && screen !== 'notFound' ? code : null} />

      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {screen === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div aria-hidden="true" className="w-10 h-10 border-4 border-brand-dark/20 border-t-brand-dark rounded-full mx-auto mb-4 animate-spin" />
              <p role="status" className="text-lg text-brand-dark/60">Finding vehicle {code}…</p>
            </motion.div>
          )}

          {screen === 'notFound' && (
            <motion.div key="notFound" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm">
              <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none font-display text-display-sm mb-2">Vehicle not found</h1>
              <p className="text-lg text-brand-dark/60">
                We couldn't find a vehicle registered as {code}. Check the code with your conductor, or scan the QR sticker again.
              </p>
              <Link
                href="/pay"
                className="mt-6 inline-flex min-h-[3.25rem] items-center rounded-2xl bg-brand-dark text-cream font-display font-bold text-lg px-6"
              >
                Enter a vehicle code
              </Link>
            </motion.div>
          )}

          {screen === 'amount' && (
            <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none text-lg text-brand-dark/70 mb-4">How much is the fare?</h1>
              <label htmlFor="fare" className="sr-only">Fare in Kenyan shillings</label>
              <input
                id="fare"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="KES"
                className="w-full font-display text-display text-center bg-transparent border-b-4 border-brand-dark/15 py-4 mb-8 focus:border-brand outline-none"
              />
              <button
                disabled={!amount || amount < 10}
                onClick={() => goTo('phone')}
                className="w-full bg-brand text-white font-display font-bold text-2xl rounded-2xl py-4 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </motion.div>
          )}

          {screen === 'phone' && (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none font-display text-display-sm mb-1">Your M-Pesa number</h1>
              <p className="text-lg text-brand-dark/60 mb-8">We'll send an STK prompt to this number.</p>
              <label htmlFor="phone" className="sr-only">M-Pesa phone number, after the +254 country code</label>
              <div className="flex items-stretch gap-3 border-b-4 border-brand-dark/15 focus-within:border-brand focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-4 focus-within:outline-route mb-3">
                {/* Fixed country code: passengers type their number the usual way. */}
                <span aria-hidden="true" className="flex items-center text-3xl font-semibold tabular-nums text-brand-dark/70 py-4">
                  +254
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={formatLocalKenyanNumber(phone)}
                  onChange={(e) => setPhone(toLocalKenyanNumber(e.target.value))}
                  placeholder="712 345 678"
                  className="flex-1 min-w-0 text-3xl tabular-nums bg-transparent py-4 outline-none focus-visible:outline-none placeholder:text-brand-dark/60"
                />
              </div>
              <p className="text-base text-brand-dark/70 mb-8">
                {phone.length === 9 && !isValidKenyanMobile(phone)
                  ? 'That doesn’t look like a Kenyan mobile number. It should start with 7 or 1.'
                  : <>Type it the usual way, like <span className="whitespace-nowrap">0712 345 678</span>.</>}
              </p>
              <button
                disabled={!isValidKenyanMobile(phone)}
                onClick={submitPay}
                className="w-full bg-brand text-white font-display font-bold text-2xl rounded-2xl py-4 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Pay KES {amount}
              </button>
            </motion.div>
          )}

          {screen === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <motion.div
                aria-hidden="true"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                className="w-16 h-16 border-4 border-wait border-t-transparent rounded-full mx-auto mb-6"
              />
              <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none font-display text-display-sm mb-2">Check your phone</h1>
              <p className="text-lg text-brand-dark/60">Enter your M-Pesa PIN on the prompt to complete payment.</p>
            </motion.div>
          )}

          {screen === 'success' && (
            <motion.div key="success" className="w-full max-w-sm text-center">
              <SuccessCheck />
              <div className="ticket-stub motion-fade-up">
                <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none font-display text-display-sm mb-4">KES {amount} paid</h1>
                <div className="border-t border-dashed border-brand-dark/15 pt-4 text-left space-y-2">
                  <p className="text-brand-dark/70">
                    Receipt <span className="font-semibold text-brand-dark tabular-nums">{receipt?.mpesa_receipt}</span>
                  </p>
                  <p className="text-lg text-brand-dark">
                    Tell the conductor: phone ending{' '}
                    <strong className="font-display tabular-nums">{receipt?.phone_last3}</strong>, receipt ending{' '}
                    <strong className="font-display tabular-nums">{receipt?.receipt_last3}</strong>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm">
              <h1 ref={focusHeading} tabIndex={-1} className="focus:outline-none font-display text-display-sm mb-2 text-red-700">Payment didn't go through</h1>
              <p className="text-lg text-brand-dark/60 mb-6">{errorMsg}</p>
              <button onClick={() => goTo('amount')} className="bg-brand-dark text-white font-display font-bold text-xl rounded-2xl px-8 py-3">
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {fromConductor && <ConductorNav active="prompt" vehicleCode={code} saccoId={searchParams.sacco} />}
    </main>
  )
}

// The instant a passenger knows their money is safe. The check draws itself,
// a route-green glow settles behind it, and the phone buzzes once as the
// stroke completes. Reduced-motion users get the finished state immediately.
function SuccessCheck() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(80)
    }, reduce ? 0 : 450)
    return () => clearTimeout(t)
  }, [])

  const [animate] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  return (
    <div className="relative w-20 h-20 mx-auto mb-8">
      <div
        aria-hidden="true"
        className={`absolute -inset-6 rounded-full ${animate ? 'motion-glow' : ''}`}
        style={{ background: 'radial-gradient(circle, rgba(30, 122, 95, 0.3) 0%, rgba(30, 122, 95, 0) 70%)' }}
      />
      <div className="relative w-20 h-20 bg-route rounded-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-11 h-11" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            pathLength={1}
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? 'motion-check-draw' : ''}
          />
        </svg>
      </div>
    </div>
  )
}
