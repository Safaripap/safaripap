'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { PIN_LENGTH } from '@/lib/conductor'
import { memberEmail } from '@/lib/member-login'
import { formatLocalKenyanNumber, isValidKenyanMobile, toLocalKenyanNumber } from '@/lib/phone'
import { SafaripapLogo } from '@/components/SafaripapLogo'
import { BackButton } from '@/components/BackButton'
import { SettingsMenu } from '@/components/SettingsMenu'

// Sacco managers and matatu owners: phone number + PIN. Accounts are created
// by Safaripap staff at /admin/people; there's no self sign-up.
export default function ManageLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('') // the 9 digits after +254
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email: memberEmail(phone), password: pin })
    if (error) {
      setErrorMsg('Wrong phone number or PIN.')
      setLoading(false)
      return
    }
    router.replace('/manage')
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
        <h1 className="text-2xl font-bold mb-1">Sacco sign in</h1>
        <p className="text-lg text-brand-dark/70 mb-6">For sacco managers and matatu owners. Use your phone number and PIN.</p>

        <label htmlFor="phone" className="block text-base font-semibold text-brand-dark mb-1">
          Phone number
        </label>
        <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-dark/15 bg-white px-4 mb-4 focus-within:border-brand">
          <span aria-hidden="true" className="text-2xl font-semibold tabular-nums text-brand-dark/70">
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
            className="flex-1 min-w-0 bg-transparent py-4 text-2xl tabular-nums outline-none focus-visible:outline-none placeholder:text-brand-dark/60"
          />
        </div>

        <label htmlFor="pin" className="block text-base font-semibold text-brand-dark mb-1">
          PIN
        </label>
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
        {errorMsg && (
          <p role="alert" className="text-red-700 text-lg text-center mb-4">
            {errorMsg}
          </p>
        )}
        <button
          type="submit"
          disabled={!isValidKenyanMobile(phone) || pin.length !== PIN_LENGTH || loading}
          className="w-full bg-brand text-white text-2xl font-bold rounded-2xl py-4 disabled:opacity-40"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-6 text-center text-brand-dark/70">
          New to Safaripap?{' '}
          <Link href="/join" className="font-semibold text-brand-dark underline underline-offset-4">
            Bring your sacco
          </Link>
        </p>
        <p className="mt-3 text-center text-brand-dark/70">
          Conductor?{' '}
          <Link href="/login" className="font-semibold text-brand-dark underline underline-offset-4">
            Sign in with your vehicle code
          </Link>
        </p>
      </form>
    </main>
  )
}
