'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Screen = 'loading' | 'notFound' | 'amount' | 'phone' | 'waiting' | 'success' | 'error'

interface Vehicle {
  vehicle_code: string
  preset_fare_kes: number | null
}

export default function PayPage({ params }: { params: { vehicleCode: string } }) {
  const [screen, setScreen] = useState<Screen>('loading')
  const [amount, setAmount] = useState<number | ''>('')
  const [phone, setPhone] = useState('')
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ mpesa_receipt: string; phone_last3: string; receipt_last3: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
        setScreen('amount')
      })
      .catch(() => setScreen('notFound'))
  }, [params.vehicleCode])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function submitPay() {
    setScreen('waiting')
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleCode: params.vehicleCode, amountKes: amount, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed to start')

      setTransactionCode(data.transactionCode)

      pollRef.current = setInterval(async () => {
        const statusRes = await fetch(`/api/transactions/${data.transactionCode}`)
        if (!statusRes.ok) return
        const statusData = await statusRes.json()
        if (statusData.status === 'fulfilled') {
          clearInterval(pollRef.current!)
          setReceipt(statusData)
          setScreen('success')
        } else if (statusData.status === 'failed') {
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
    <main className="min-h-screen flex flex-col px-6 pt-8 pb-10">
      {screen !== 'loading' && screen !== 'notFound' && (
        <div className="mb-8">
          <span className="route-plate">{code}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {screen === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="w-10 h-10 border-4 border-brand-dark/20 border-t-brand-dark rounded-full mx-auto mb-4 animate-spin" />
              <p className="text-lg text-brand-dark/50">Finding vehicle {code}…</p>
            </motion.div>
          )}

          {screen === 'notFound' && (
            <motion.div key="notFound" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm">
              <h1 className="font-display text-display-sm mb-2">Vehicle not found</h1>
              <p className="text-lg text-brand-dark/60">
                We couldn't find a vehicle registered as {code}. Check the code with your conductor, or scan the QR sticker again.
              </p>
            </motion.div>
          )}

          {screen === 'amount' && (
            <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <p className="text-lg text-brand-dark/60 mb-4">How much is the fare?</p>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="KES"
                className="w-full font-display text-display text-center bg-transparent border-b-4 border-brand-dark/15 py-4 mb-8 focus:border-brand outline-none"
              />
              <button
                disabled={!amount || amount < 10}
                onClick={() => setScreen('phone')}
                className="w-full bg-brand text-white font-display text-2xl tracking-wide rounded-2xl py-4 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </motion.div>
          )}

          {screen === 'phone' && (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
              <h1 className="font-display text-display-sm mb-1">Your M-Pesa number</h1>
              <p className="text-lg text-brand-dark/60 mb-8">We'll send an STK prompt to this number.</p>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="2547XXXXXXXX"
                className="w-full text-3xl text-center bg-transparent border-b-4 border-brand-dark/15 py-4 mb-8 focus:border-brand outline-none"
              />
              <button
                disabled={phone.length < 12}
                onClick={submitPay}
                className="w-full bg-brand text-white font-display text-2xl tracking-wide rounded-2xl py-4 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Pay KES {amount}
              </button>
            </motion.div>
          )}

          {screen === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                className="w-16 h-16 border-4 border-wait border-t-transparent rounded-full mx-auto mb-6"
              />
              <h1 className="font-display text-display-sm mb-2">Check your phone</h1>
              <p className="text-lg text-brand-dark/60">Enter your M-Pesa PIN on the prompt to complete payment.</p>
            </motion.div>
          )}

          {screen === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="w-20 h-20 bg-route rounded-full flex items-center justify-center mx-auto mb-6 text-white text-4xl"
              >
                ✓
              </motion.div>
              <div className="ticket-stub">
                <p className="text-sm uppercase tracking-widest text-brand-dark/40 mb-1">Paid</p>
                <p className="font-display text-display-sm mb-4">KES {amount}</p>
                <div className="border-t border-dashed border-brand-dark/15 pt-4 text-left space-y-1">
                  <p className="text-brand-dark/70">Receipt <span className="font-semibold text-brand-dark">{receipt?.mpesa_receipt}</span></p>
                  <p className="text-brand-dark/70">
                    Show the conductor: <span className="font-semibold text-brand-dark">…{receipt?.phone_last3}</span> or{' '}
                    <span className="font-semibold text-brand-dark">…{receipt?.receipt_last3}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {screen === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm">
              <h1 className="font-display text-display-sm mb-2 text-red-600">Payment didn't go through</h1>
              <p className="text-lg text-brand-dark/60 mb-6">{errorMsg}</p>
              <button onClick={() => setScreen('amount')} className="bg-brand-dark text-white font-display text-xl tracking-wide rounded-2xl px-8 py-3">
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
