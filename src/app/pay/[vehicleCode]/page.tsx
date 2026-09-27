'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Screen = 'amount' | 'phone' | 'waiting' | 'success' | 'error'

interface Vehicle {
  vehicle_code: string
  preset_fare_kes: number | null
}

export default function PayPage({ params }: { params: { vehicleCode: string } }) {
  const [screen, setScreen] = useState<Screen>('amount')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [amount, setAmount] = useState<number | ''>('')
  const [phone, setPhone] = useState('')
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ mpesa_receipt: string; phone_last3: string; receipt_last3: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`/api/vehicles/${params.vehicleCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v) {
          setVehicle(v)
          if (v.preset_fare_kes) setAmount(v.preset_fare_kes)
        }
      })
      .catch(() => {})
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

      let attempts = 0
      const MAX_ATTEMPTS = 40 // ~80s at 2s/poll — long enough for a real STK prompt, short enough not to hang forever
      pollRef.current = setInterval(async () => {
        attempts++
        if (attempts > MAX_ATTEMPTS) {
          clearInterval(pollRef.current!)
          setErrorMsg('This is taking longer than expected. Check with the conductor, or try again.')
          setScreen('error')
          return
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <AnimatePresence mode="wait">
        {screen === 'amount' && (
          <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
            <h1 className="text-2xl font-bold mb-1">Vehicle {params.vehicleCode}</h1>
            <p className="text-lg text-gray-500 mb-6">How much is the fare?</p>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder="KES"
              className="w-full text-display text-center border-2 border-gray-200 rounded-2xl py-4 mb-6 focus:border-brand outline-none"
            />
            <button
              disabled={!amount || amount < 10}
              onClick={() => setScreen('phone')}
              className="w-full bg-brand text-white text-2xl font-bold rounded-2xl py-4 disabled:opacity-40"
            >
              Continue
            </button>
          </motion.div>
        )}

        {screen === 'phone' && (
          <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
            <h1 className="text-2xl font-bold mb-1">Your M-Pesa number</h1>
            <p className="text-lg text-gray-500 mb-6">We'll send an STK prompt to this number.</p>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              className="w-full text-3xl text-center border-2 border-gray-200 rounded-2xl py-4 mb-6 focus:border-brand outline-none"
            />
            <button
              disabled={phone.replace(/\D/g, '').length < 10}
              onClick={submitPay}
              className="w-full bg-brand text-white text-2xl font-bold rounded-2xl py-4 disabled:opacity-40"
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
              className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full mx-auto mb-6"
            />
            <h1 className="text-2xl font-bold mb-2">Check your phone</h1>
            <p className="text-lg text-gray-500">Enter your M-Pesa PIN on the prompt to complete payment.</p>
          </motion.div>
        )}

        {screen === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-5xl"
            >
              ✓
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">Paid!</h1>
            <p className="text-xl text-gray-600 mb-1">Receipt: {receipt?.mpesa_receipt}</p>
            <p className="text-lg text-gray-500">
              Tell the conductor the last 3 digits of your number ({receipt?.phone_last3}) or your receipt code ({receipt?.receipt_last3}).
            </p>
          </motion.div>
        )}

        {screen === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <h1 className="text-2xl font-bold mb-2 text-red-600">{errorMsg}</h1>
            <button onClick={() => setScreen('amount')} className="mt-6 bg-brand text-white text-xl font-bold rounded-2xl px-8 py-3">
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
