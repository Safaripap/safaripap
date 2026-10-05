'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Publish today's signed Nostr report for this member's matatus (the daily
// job publishes each finished day automatically), and link to the public
// check. Ported from Nauli Sacco's NostrPublish.
export function NostrReport({ firstVehicle }: { firstVehicle?: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'busy' } | { status: 'done' | 'error'; message: string }>({ status: 'idle' })

  async function publish() {
    setState({ status: 'busy' })
    try {
      const { data } = await supabaseBrowser.auth.getSession()
      const res = await fetch('/api/manage/nostr-report', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      const failed = body.failures?.length ?? 0
      setState({
        status: failed ? 'error' : 'done',
        message: `Published ${body.reports.length} signed ${body.reports.length === 1 ? 'report' : 'reports'} for today${
          failed ? `; ${failed} failed (${body.failures.map((f: any) => f.vehicleCode).join(', ')}). Try again.` : '.'
        }`,
      })
    } catch (err: any) {
      setState({ status: 'error', message: err?.message || 'Couldn’t publish. Check your connection and try again.' })
    }
  }

  return (
    <section aria-labelledby="nostr-heading" className="mt-10 rounded-2xl border-2 border-brand-dark/10 bg-white p-4">
      <h2 id="nostr-heading" className="text-xl font-semibold">Public record</h2>
      <p className="mt-1 text-base text-brand-dark/70">
        Each night Safaripap signs every matatu&apos;s paid fares and publishes them on Nostr, so anyone can check the
        numbers weren&apos;t changed later. No phone numbers or receipts are published.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={state.status === 'busy'}
          className="rounded-xl bg-brand-dark px-4 text-base font-semibold text-cream disabled:opacity-40"
        >
          {state.status === 'busy' ? 'Publishing…' : 'Publish today’s report now'}
        </button>
        <Link
          href={firstVehicle ? `/verify?vehicle=${firstVehicle}` : '/verify'}
          className="inline-flex min-h-[3.25rem] items-center rounded-xl border-2 border-brand-dark/15 px-4 text-base font-semibold"
        >
          Check a day
        </Link>
      </div>
      {(state.status === 'done' || state.status === 'error') && (
        <p role="status" className={`mt-3 text-base ${state.status === 'error' ? 'text-red-700' : 'text-route'}`}>
          {state.message}
        </p>
      )}
    </section>
  )
}
