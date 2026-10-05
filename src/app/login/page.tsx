'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { conductorEmail, PIN_LENGTH } from '@/lib/conductor'
import { SafaripapLogo } from '@/components/SafaripapLogo'
import { BackButton } from '@/components/BackButton'
import { SettingsMenu } from '@/components/SettingsMenu'

// Conductor sign-in: vehicle code + PIN. Accounts are created with
// `npm run create-conductor`, there's no self sign-up.
export default function LoginPage() {
  const router = useRouter()
  const [vehicleCode, setVehicleCode] = useState('')
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Coming back from the dashboard (signed out, or the session ended), the
  // vehicle code is already known: fill it in so only the PIN is needed.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vehicle')
    if (v) setVehicleCode(v.toUpperCase())
  }, [])

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const code = vehicleCode.trim().toUpperCase()
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: conductorEmail(code),
      password: pin,
    })

    if (error) {
      setErrorMsg('Wrong vehicle code or PIN.')
      setLoading(false)
      return
    }
    router.replace(`/dashboard/${code}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <form onSubmit={signIn} className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BackButton href="/signin" label="Back" />
            <Link href="/" aria-label="Safaripap home" className="inline-flex min-h-[3.25rem] items-center rounded-lg">
              <SafaripapLogo size="sm" wordmark={false} />
            </Link>
          </div>
          <SettingsMenu />
        </div>
        <h1 className="text-2xl font-bold mb-1">Conductor sign in</h1>
        <p className="text-lg text-brand-dark/70 mb-6">Enter your vehicle code and PIN.</p>
        <label htmlFor="vehicle-code" className="sr-only">Vehicle code</label>
        <input
          id="vehicle-code"
          value={vehicleCode}
          onChange={(e) => setVehicleCode(e.target.value)}
          placeholder="Vehicle code, e.g. KAB123B"
          autoCapitalize="characters"
          autoComplete="username"
          className="w-full text-2xl text-center uppercase border-2 border-brand-dark/15 bg-white rounded-2xl py-4 mb-4 focus:border-brand outline-none"
        />
        <label htmlFor="pin" className="sr-only">PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder={`${PIN_LENGTH}-digit PIN`}
          autoComplete="current-password"
          className="w-full text-3xl text-center tracking-widest border-2 border-brand-dark/15 bg-white rounded-2xl py-4 mb-6 focus:border-brand outline-none"
        />
        {errorMsg && <p role="alert" className="text-red-700 text-lg text-center mb-4">{errorMsg}</p>}
        <button
          type="submit"
          disabled={!vehicleCode.trim() || pin.length !== PIN_LENGTH || loading}
          className="w-full bg-brand text-white text-2xl font-bold rounded-2xl py-4 disabled:opacity-40"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-6 text-center text-brand-dark/70">
          Sacco manager or owner?{' '}
          <Link href="/manage/login" className="font-semibold text-brand-dark underline underline-offset-4">
            Sign in with your phone
          </Link>
        </p>
      </form>
    </main>
  )
}
