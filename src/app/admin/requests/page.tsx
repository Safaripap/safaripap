'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { AdminNav } from '@/components/AdminNav'
import { AdminGate } from '@/components/AdminGate'
import { ROLE_LABEL, type MemberRole } from '@/lib/member-login'
import { formatLocalKenyanNumber, toLocalKenyanNumber } from '@/lib/phone'

interface JoinRequest {
  id: string
  sacco_name: string
  contact_name: string
  phone: string
  role: MemberRole
  matatu_count: number
  plates: string[]
  notes: string | null
  status: 'new' | 'done' | 'dismissed'
  created_at: string
}

const displayPhone = (p: string) => `0${formatLocalKenyanNumber(toLocalKenyanNumber(p))}`
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const BUTTON = 'inline-flex min-h-[3.25rem] items-center rounded-xl px-4 text-base font-semibold'

export default function RequestsPage() {
  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />
        <AdminGate title="Requests">{(lock) => <Requests lock={lock} />}</AdminGate>
      </div>
    </main>
  )
}

function Requests({ lock }: { lock: () => void }) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [error, setError] = useState('')
  const [showHandled, setShowHandled] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/requests').catch(() => null)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setError(body?.error || 'Could not load requests.')
    setRequests(body.requests)
  }, [lock])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id: string, status: JoinRequest['status']) {
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null)
    if (res?.status === 401) return lock()
    if (!res || !res.ok) return setError('Could not update that request. Try again.')
    setRequests((rs) => rs?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null)
  }

  const open = requests?.filter((r) => r.status === 'new') ?? []
  const handled = requests?.filter((r) => r.status !== 'new') ?? []

  return (
    <>
      <AdminNav active="requests" />
      <h1 className="font-display text-display-sm mb-2">Requests</h1>
      <p className="text-lg text-brand-dark/70 mb-8">
        Saccos and owners who asked to join from <strong>/join</strong>. Call them, onboard their matatus, then create their
        sign-in.
      </p>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border-2 border-red-700/30 bg-white p-4 text-red-700">
          {error}
        </p>
      )}
      {!requests && !error && <p role="status" className="text-brand-dark/70">Loading…</p>}
      {requests && open.length === 0 && (
        <p className="mb-6 text-brand-dark/70">No new requests. Share the link: your site’s address followed by /join.</p>
      )}

      <ul className="space-y-3">
        {open.map((r) => (
          <RequestCard key={r.id} r={r} onStatus={setStatus} />
        ))}
      </ul>

      {handled.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowHandled((s) => !s)}
            aria-expanded={showHandled}
            className={`${BUTTON} border-2 border-brand-dark/15 bg-white`}
          >
            {showHandled ? 'Hide' : 'Show'} {handled.length} handled {handled.length === 1 ? 'request' : 'requests'}
          </button>
          {showHandled && (
            <ul className="mt-3 space-y-3">
              {handled.map((r) => (
                <RequestCard key={r.id} r={r} onStatus={setStatus} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function RequestCard({ r, onStatus }: { r: JoinRequest; onStatus: (id: string, s: JoinRequest['status']) => void }) {
  const sacco = encodeURIComponent(r.sacco_name)
  const peopleHref = `/admin/people?name=${encodeURIComponent(r.contact_name)}&phone=${r.phone}&role=${r.role}&sacco=${sacco}`
  return (
    <li className={`rounded-2xl border-2 border-brand-dark/10 bg-white p-5 ${r.status !== 'new' ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{r.sacco_name}</h2>
          <p className="text-brand-dark/70">
            {r.contact_name} · {ROLE_LABEL[r.role]} ·{' '}
            <a href={`tel:+${r.phone}`} className="font-semibold text-brand-dark underline underline-offset-4 tabular-nums">
              {displayPhone(r.phone)}
            </a>
          </p>
        </div>
        <p className="text-sm text-brand-dark/70">
          {r.status === 'done' ? 'Done · ' : r.status === 'dismissed' ? 'Dismissed · ' : ''}
          {when(r.created_at)}
        </p>
      </div>

      <p className="mt-3">
        <strong>{r.matatu_count}</strong> {r.matatu_count === 1 ? 'matatu' : 'matatus'}
        {r.plates.length > 0 && (
          <>
            {' · '}
            <span className="font-display font-bold tabular-nums">{r.plates.join(', ')}</span>
          </>
        )}
      </p>
      {r.notes && <p className="mt-2 whitespace-pre-wrap text-brand-dark/70">“{r.notes}”</p>}

      {r.status === 'new' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.plates.length > 0 ? (
            r.plates.map((p) => (
              <Link
                key={p}
                href={`/admin/onboard?plate=${p}&sacco=${sacco}`}
                className={`${BUTTON} bg-brand text-white`}
              >
                Onboard <span className="ml-1 font-display tabular-nums">{p}</span>
              </Link>
            ))
          ) : (
            <Link href={`/admin/onboard?sacco=${sacco}`} className={`${BUTTON} bg-brand text-white`}>
              Onboard a matatu
            </Link>
          )}
          <Link href={peopleHref} className={`${BUTTON} border-2 border-brand-dark/15 bg-white`}>
            Create their sign-in
          </Link>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {r.status === 'new' ? (
          <>
            <button onClick={() => onStatus(r.id, 'done')} className={`${BUTTON} border-2 border-brand-dark/15 bg-white`}>
              Mark done
            </button>
            <button onClick={() => onStatus(r.id, 'dismissed')} className={`${BUTTON} border-2 border-brand-dark/15 bg-white text-red-700`}>
              Dismiss
            </button>
          </>
        ) : (
          <button onClick={() => onStatus(r.id, 'new')} className={`${BUTTON} border-2 border-brand-dark/15 bg-white`}>
            Reopen
          </button>
        )}
      </div>
    </li>
  )
}
