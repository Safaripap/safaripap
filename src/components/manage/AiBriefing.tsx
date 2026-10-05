'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

// The optional Claude-written summary of the forecast, loaded separately so
// the numbers render instantly. Ported from Nauli Sacco.

export function AiBriefing() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ok'; text: string } | { status: 'error'; message: string }
  >({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession()
        const res = await fetch('/api/manage/forecast/briefing', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        })
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
        if (cancelled) return
        setState(
          res.ok && json.text
            ? { status: 'ok', text: json.text }
            : { status: 'error', message: json.error ?? 'AI summary unavailable' }
        )
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'AI summary unavailable' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-2xl border-2 border-brand-dark/10 bg-white p-4" aria-live="polite">
      <h2 className="text-xl font-semibold">AI summary</h2>
      <p className="mb-2 text-sm text-brand-dark/70">Written by Claude from the numbers on this page.</p>
      {state.status === 'loading' ? (
        <div className="space-y-2" aria-label="Writing the briefing">
          <div className="h-4 w-full rounded bg-brand-dark/10 motion-safe:animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-brand-dark/10 motion-safe:animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-brand-dark/10 motion-safe:animate-pulse" />
        </div>
      ) : null}
      {state.status === 'ok' ? <p className="text-lg leading-relaxed">{state.text}</p> : null}
      {state.status === 'error' ? <p className="text-base text-brand-dark/70">{state.message}</p> : null}
    </section>
  )
}
