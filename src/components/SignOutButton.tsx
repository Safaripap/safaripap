'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Sign out, with a second tap to confirm: a stray tap on a moving matatu
// shouldn't log the conductor out mid-shift. The confirm state lapses after
// a few seconds.
const CONFIRM_MS = 4000

export function SignOutButton({ onSignedOut }: { onSignedOut: () => void }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [armed])

  async function click() {
    if (!armed) return setArmed(true)
    setBusy(true)
    await supabaseBrowser.auth.signOut()
    onSignedOut()
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className={`shrink-0 rounded-xl border-2 px-3 font-semibold disabled:opacity-50 ${
        armed ? 'border-red-700 bg-red-50 text-sm text-red-800' : 'border-brand-dark/15 bg-white text-base text-brand-dark'
      }`}
    >
      {busy ? 'Signing out…' : armed ? 'Tap again to sign out' : 'Sign out'}
    </button>
  )
}
