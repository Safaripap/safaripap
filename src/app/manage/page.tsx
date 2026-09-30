'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { ROLE_LABEL, type MemberRole } from '@/lib/member-login'
import { AppHeader } from '@/components/AppHeader'

interface Me {
  role: MemberRole
  fullName: string
  saccoName: string
  vehicles: { id: string; vehicle_code: string }[]
}

// The sacco manager / matatu owner home. For now it confirms who's signed in
// and which matatus they can see; the metrics dashboard builds on this.
export default function ManagePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (!data.session) return router.replace('/manage/login')
      const res = await fetch('/api/manage/me', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
      if (res.status === 401) {
        // Signed in, but not as a manager or owner (e.g. a conductor).
        setError('This account isn’t a sacco manager or owner. Sign out and sign in with your phone number.')
        return
      }
      if (!res.ok) return setError('Couldn’t load your account. Check your connection and refresh.')
      setMe(await res.json())
    })()
  }, [router])

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.replace('/manage/login')
  }

  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <AppHeader />

        {!me && !error && <p role="status" className="text-brand-dark/70">Loading…</p>}

        {error && (
          <div className="max-w-md">
            <p role="alert" className="text-lg text-red-700 mb-4">
              {error}
            </p>
            <button onClick={signOut} className="rounded-2xl bg-brand-dark px-6 font-display font-bold text-lg text-cream">
              Sign out
            </button>
          </div>
        )}

        {me && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-lg text-brand-dark/70">
                  {ROLE_LABEL[me.role]} · {me.saccoName}
                </p>
                <h1 className="font-display text-display-sm">Hi, {me.fullName.split(' ')[0]}</h1>
              </div>
              <button
                onClick={signOut}
                className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold"
              >
                Sign out
              </button>
            </div>

            <h2 className="text-xl font-semibold mb-3">
              {me.role === 'manager' ? 'Matatus in your sacco' : 'Your matatus'}
            </h2>
            {me.vehicles.length === 0 ? (
              <p className="text-brand-dark/70">No matatus yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {me.vehicles.map((v) => (
                  <li key={v.id} className="route-plate">
                    {v.vehicle_code}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  )
}
