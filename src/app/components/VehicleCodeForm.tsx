'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VehicleCodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) {
      setError('Enter the code shown inside the vehicle.')
      return
    }
    router.push(`/pay/${encodeURIComponent(clean)}`)
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      <label htmlFor="vehicle-code" className="mb-2 block text-lg font-medium">
        Vehicle code
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="vehicle-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          placeholder="KAB123B"
          autoCapitalize="characters"
          autoComplete="off"
          aria-describedby={error ? 'vehicle-code-error' : undefined}
          className="min-w-0 flex-1 rounded-2xl border-2 border-brand-dark/25 bg-white px-4 py-3 text-2xl uppercase tracking-wide placeholder:text-brand-dark/40 focus:border-brand-dark"
        />
        <button
          type="submit"
          className="rounded-2xl bg-brand px-6 py-3 font-display text-2xl tracking-wide text-brand-dark transition active:scale-[0.98]"
        >
          Pay a fare
        </button>
      </div>
      {error && (
        <p id="vehicle-code-error" role="alert" className="mt-2 text-lg text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
