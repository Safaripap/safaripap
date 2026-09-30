'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { AdminNav } from '@/components/AdminNav'
import { AdminGate } from '@/components/AdminGate'
import { ROLE_LABEL, type MemberRole } from '@/lib/member-login'
import { formatLocalKenyanNumber, isValidKenyanMobile, toLocalKenyanNumber } from '@/lib/phone'

interface Sacco {
  id: string
  name: string
  vehicles: { id: string; vehicleCode: string; isDemo?: boolean }[]
}

interface Member {
  userId: string
  role: MemberRole
  fullName: string
  phone: string
  saccoId: string
  saccoName: string
  vehicleCodes: string[]
}

// A PIN to hand over, shown once: after creating someone or resetting theirs.
interface Handover {
  fullName: string
  phone: string
  pin: string
  reset: boolean
}

const INPUT =
  'w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg text-brand-dark placeholder:text-brand-dark/60 focus:border-brand outline-none'
const LABEL = 'block text-base font-semibold text-brand-dark mb-1'

// "254712345678" → "0712 345 678"
const displayPhone = (p: string) => `0${formatLocalKenyanNumber(toLocalKenyanNumber(p))}`

export default function PeoplePage() {
  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />
        <AdminGate title="Managers & owners">{(lock) => <People lock={lock} />}</AdminGate>
      </div>
    </main>
  )
}

function People({ lock }: { lock: () => void }) {
  const [saccos, setSaccos] = useState<Sacco[] | null>(null)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [role, setRole] = useState<MemberRole>('manager')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saccoId, setSaccoId] = useState('')
  const [vehicleIds, setVehicleIds] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [rowError, setRowError] = useState('')
  const handoverRef = useRef<HTMLHeadingElement>(null)

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([fetch('/api/admin/saccos'), fetch('/api/admin/members')])
    if (s.status === 401 || m.status === 401) return lock()
    const sd = await s.json().catch(() => ({ saccos: [] }))
    const md = await m.json().catch(() => ({ members: [] }))
    setSaccos(sd.saccos ?? [])
    setMembers(md.members ?? [])
    setSaccoId((id) => id || sd.saccos?.[0]?.id || '')
  }, [lock])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (handover) handoverRef.current?.focus()
  }, [handover])

  const sacco = saccos?.find((s) => s.id === saccoId)
  const localPhone = toLocalKenyanNumber(phone)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, fullName, phone: localPhone, saccoId, vehicleIds: role === 'owner' ? vehicleIds : [] }),
    }).catch(() => null)
    setSaving(false)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setFormError(body?.error || 'Could not reach the server. Try again.')
    setHandover({ fullName: fullName.trim(), phone: body.phone, pin: body.pin, reset: false })
    setFullName('')
    setPhone('')
    setVehicleIds([])
    load()
  }

  async function resetPin(m: Member) {
    setRowError('')
    const res = await fetch(`/api/admin/members/${m.userId}`, { method: 'PATCH' }).catch(() => null)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) return setRowError(body?.error || `Couldn't reset ${m.fullName}'s PIN.`)
    setHandover({ fullName: m.fullName, phone: m.phone, pin: body.pin, reset: true })
  }

  async function remove(m: Member) {
    setRowError('')
    const res = await fetch(`/api/admin/members/${m.userId}`, { method: 'DELETE' }).catch(() => null)
    if (res?.status === 401) return lock()
    setConfirmRemove(null)
    if (!res || !res.ok) return setRowError(`Couldn't remove ${m.fullName}. Try again.`)
    load()
  }

  function toggleVehicle(id: string) {
    setVehicleIds((ids) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]))
  }

  return (
    <>
      <AdminNav active="people" />
      <h1 className="font-display text-display-sm mb-2">Managers & owners</h1>
      <p className="text-lg text-brand-dark/70 mb-8">
        They sign in at <strong>/manage/login</strong> with their phone number and a PIN to see fare totals. Managers see
        their whole sacco; owners see only their own matatus.
      </p>

      {handover && (
        <section
          aria-labelledby="handover-heading"
          className="mb-8 rounded-2xl border-2 border-route bg-route-light p-5 motion-fade-up"
        >
          <h2 id="handover-heading" ref={handoverRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {handover.reset ? `New PIN for ${handover.fullName}` : `${handover.fullName} can sign in now`}
          </h2>
          <p className="mt-3 text-brand-dark/70">Phone</p>
          <p className="text-xl font-semibold tabular-nums">{displayPhone(handover.phone)}</p>
          <p className="mt-3 text-brand-dark/70">PIN</p>
          <p className="font-display text-display-sm tabular-nums tracking-[0.15em]">{handover.pin}</p>
          <p className="mt-3 text-brand-dark">Shown only once. Give it to them now; they can’t recover it.</p>
          <button
            onClick={() => setHandover(null)}
            className="mt-4 rounded-xl bg-brand-dark px-5 text-base font-semibold text-cream"
          >
            Done
          </button>
        </section>
      )}

      <form onSubmit={create} className="mb-12 max-w-lg space-y-5 rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Add someone</h2>

        <fieldset>
          <legend className={LABEL}>Role</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['manager', 'owner'] as const).map((r) => (
              <label
                key={r}
                className={`flex min-h-[3.25rem] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${
                  role === r ? 'border-brand-dark bg-cream' : 'border-brand-dark/15'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-1 h-5 w-5 accent-brand-dark"
                />
                <span>
                  <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                  <span className="block text-sm text-brand-dark/70">
                    {r === 'manager' ? 'Sees every matatu in the sacco' : 'Sees only the matatus you pick'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="full-name" className={LABEL}>
            Full name
          </label>
          <input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" className={INPUT} required />
        </div>

        <div>
          <label htmlFor="member-phone" className={LABEL}>
            Phone number
          </label>
          <div className="flex items-center gap-3 rounded-xl border-2 border-brand-dark/15 bg-white px-4 focus-within:border-brand">
            <span aria-hidden="true" className="text-lg font-semibold tabular-nums text-brand-dark/70">
              +254
            </span>
            <input
              id="member-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={formatLocalKenyanNumber(localPhone)}
              onChange={(e) => setPhone(toLocalKenyanNumber(e.target.value))}
              placeholder="712 345 678"
              aria-describedby="member-phone-hint"
              className="flex-1 min-w-0 min-h-[3.25rem] bg-transparent text-lg tabular-nums outline-none focus-visible:outline-none placeholder:text-brand-dark/60"
            />
          </div>
          <p id="member-phone-hint" className="mt-1 text-sm text-brand-dark/70">
            {localPhone.length === 9 && !isValidKenyanMobile(localPhone)
              ? 'That doesn’t look like a Kenyan mobile number. It should start with 7 or 1.'
              : 'This is what they’ll sign in with.'}
          </p>
        </div>

        <div>
          <label htmlFor="member-sacco" className={LABEL}>
            Sacco
          </label>
          <select
            id="member-sacco"
            value={saccoId}
            onChange={(e) => {
              setSaccoId(e.target.value)
              setVehicleIds([])
            }}
            disabled={!saccos?.length}
            className={`${INPUT} disabled:opacity-60`}
          >
            {!saccos && <option value="">Loading saccos…</option>}
            {saccos?.length === 0 && <option value="">No saccos yet: onboard a matatu first</option>}
            {saccos?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {role === 'owner' && (
          <fieldset>
            <legend className={LABEL}>Matatus they own</legend>
            {sacco && sacco.vehicles.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {sacco.vehicles.map((v) => (
                  <li key={v.id}>
                    <label
                      className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${
                        vehicleIds.includes(v.id) ? 'border-brand-dark bg-cream' : 'border-brand-dark/15'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={vehicleIds.includes(v.id)}
                        onChange={() => toggleVehicle(v.id)}
                        className="h-5 w-5 accent-brand-dark"
                      />
                      <span className="font-display font-bold tabular-nums">{v.vehicleCode}</span>
                      {v.isDemo && <span className="text-sm text-brand-dark/70">Demo</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-brand-dark/70">This sacco has no matatus yet. Onboard one first.</p>
            )}
          </fieldset>
        )}

        {formError && (
          <p role="alert" className="text-red-700">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !saccoId || !fullName.trim() || !isValidKenyanMobile(localPhone) || (role === 'owner' && !vehicleIds.length)}
          className="w-full rounded-2xl bg-brand text-white font-display font-bold text-xl px-4 disabled:opacity-40"
        >
          {saving ? 'Creating…' : `Create ${ROLE_LABEL[role].toLowerCase()} login`}
        </button>
      </form>

      <section aria-labelledby="people-heading">
        <h2 id="people-heading" className="text-xl font-semibold mb-3">
          Everyone with access
        </h2>
        {rowError && (
          <p role="alert" className="mb-3 text-red-700">
            {rowError}
          </p>
        )}
        {!members && <p role="status" className="text-brand-dark/70">Loading…</p>}
        {members?.length === 0 && <p className="text-brand-dark/70">No managers or owners yet. Add the first one above.</p>}
        <ul className="space-y-2">
          {members?.map((m) => (
            <li key={m.userId} className="rounded-xl border-2 border-brand-dark/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{m.fullName}</p>
                  <p className="text-brand-dark/70 tabular-nums">
                    {displayPhone(m.phone)} · {m.saccoName}
                  </p>
                  {m.role === 'owner' && m.vehicleCodes.length > 0 && (
                    <p className="mt-1 font-display font-bold tabular-nums">{m.vehicleCodes.join(', ')}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    m.role === 'manager' ? 'bg-brand-dark text-cream' : 'bg-brand-dark/5 text-brand-dark'
                  }`}
                >
                  {ROLE_LABEL[m.role]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => resetPin(m)}
                  className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold"
                >
                  Reset PIN
                </button>
                {confirmRemove === m.userId ? (
                  <>
                    <button onClick={() => remove(m)} className="rounded-xl bg-red-700 px-4 text-base font-semibold text-white">
                      Yes, remove {m.fullName.split(' ')[0]}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(m.userId)}
                    className="rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-base font-semibold text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
