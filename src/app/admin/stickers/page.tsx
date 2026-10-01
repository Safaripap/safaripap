'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { AdminNav } from '@/components/AdminNav'
import { AdminGate } from '@/components/AdminGate'
import { Sticker } from '@/components/Sticker'

interface Sacco {
  id: string
  name: string
  vehicles: { id: string; vehicleCode: string; isDemo?: boolean }[]
}

interface StickerData {
  vehicleCode: string
  payUrl: string
  qrSvg: string
  local: boolean
}

export default function StickersPage() {
  return (
    <main className="min-h-screen p-4 pb-16 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <AppHeader />
        <AdminGate title="Stickers">{(lock) => <Stickers lock={lock} />}</AdminGate>
      </div>
    </main>
  )
}

function Stickers({ lock }: { lock: () => void }) {
  const [saccos, setSaccos] = useState<Sacco[] | null>(null)
  const [code, setCode] = useState('')
  const [sticker, setSticker] = useState<StickerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/saccos')
      .then((r) => (r.status === 401 ? (lock(), null) : r.json()))
      .then((d) => {
        if (!d) return
        const list: Sacco[] = (d.saccos ?? [])
          .map((s: Sacco) => ({ ...s, vehicles: s.vehicles.filter((v) => !v.isDemo) }))
          .filter((s: Sacco) => s.vehicles.length > 0)
        setSaccos(list)
        setCode((c) => c || list[0]?.vehicles[0]?.vehicleCode || '')
      })
      .catch(() => setSaccos([]))
  }, [lock])

  const load = useCallback(async () => {
    if (!code) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/sticker?vehicle=${encodeURIComponent(code)}`).catch(() => null)
    setLoading(false)
    if (res?.status === 401) return lock()
    const body = await res?.json().catch(() => ({}))
    if (!res || !res.ok) {
      setSticker(null)
      return setError(body?.error || 'Could not reach the server. Try again.')
    }
    setSticker(body)
  }, [code, lock])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <AdminNav active="stickers" />
      <h1 className="font-display text-display-sm mb-2">Stickers</h1>
      <p className="text-lg text-brand-dark/70 mb-8">
        Reprint the QR sticker for a matatu: if one is lost or damaged, or was printed before the site’s address was set.
      </p>

      {saccos?.length === 0 && <p className="text-brand-dark/70">No real matatus yet. Onboard one first.</p>}

      {saccos && saccos.length > 0 && (
        <div className="mb-8 max-w-sm">
          <label htmlFor="sticker-vehicle" className="block text-base font-semibold text-brand-dark mb-1">
            Matatu
          </label>
          <select
            id="sticker-vehicle"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full min-h-[3.25rem] rounded-xl border-2 border-brand-dark/15 bg-white px-4 text-lg font-display font-bold tabular-nums focus:border-brand outline-none"
          >
            {saccos.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.vehicles.map((v) => (
                  <option key={v.id} value={v.vehicleCode}>
                    {v.vehicleCode}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-6 max-w-lg rounded-xl border-2 border-red-700/30 bg-white p-4 text-red-700">
          {error}
        </p>
      )}

      {!sticker && loading && <p role="status" className="text-brand-dark/70">Loading sticker…</p>}

      {sticker && (
        <div className={`grid gap-6 md:grid-cols-2 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
          <Sticker vehicleCode={sticker.vehicleCode} payUrl={sticker.payUrl} qrSvg={sticker.qrSvg} />
          <div className="space-y-4">
            {sticker.local ? (
              <div role="alert" className="rounded-2xl border-2 border-wait bg-wait-light p-5 text-wait-ink">
                <h2 className="text-lg font-semibold">Don’t print this one yet</h2>
                <p className="mt-1">
                  It points at <strong className="break-all">{new URL(sticker.payUrl).host}</strong>, which only works on
                  this computer. Set <code>NEXT_PUBLIC_APP_URL</code> to the deployed site’s address, restart, and reprint.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-brand-dark/10 bg-white p-5">
                <h2 className="text-lg font-semibold">Ready to print</h2>
                <p className="mt-1 text-brand-dark/70">
                  Scanning it opens <span className="break-all font-semibold text-brand-dark">{sticker.payUrl}</span>. Test it
                  with your phone’s camera before sticking it up.
                </p>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="w-full rounded-2xl bg-brand-dark text-cream font-display font-bold text-xl px-4"
            >
              Print sticker
            </button>
          </div>
        </div>
      )}
    </>
  )
}
