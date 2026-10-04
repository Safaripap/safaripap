'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { getPreference, setPreference, type Preference } from '@/lib/preferences'
import { canSpeak, speak } from '@/lib/speech'

// Settings button + panel. The conductor dashboard shows the alert toggles;
// every screen gets the high-contrast toggle, and "Read results aloud" where
// the browser can speak.
export function SettingsMenu({ alerts = false }: { alerts?: boolean }) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<Record<Preference, boolean>>({
    sound: true,
    vibrate: true,
    highContrast: false,
    readAloud: true,
  })
  // Only offer reading aloud where the browser can actually speak; decided
  // after mount so server and client render the same.
  const [speechOk, setSpeechOk] = useState(false)
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // localStorage only exists in the browser, so read after mount.
  useEffect(() => {
    setPrefs({
      sound: getPreference('sound'),
      vibrate: getPreference('vibrate'),
      highContrast: getPreference('highContrast'),
      readAloud: getPreference('readAloud'),
    })
    setSpeechOk(canSpeak())
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  function toggle(pref: Preference, on: boolean) {
    setPreference(pref, on)
    setPrefs((p) => ({ ...p, [pref]: on }))
    if (on && pref === 'readAloud') speak('Results will be read aloud.', { force: true, fromTap: true })
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-[3.25rem] items-center justify-center rounded-xl border-2 border-brand-dark/15 bg-white text-brand-dark"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Settings"
          className="settings-panel absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white p-2 shadow-[0_12px_30px_-12px_rgba(26,26,46,0.35)]"
        >
          {alerts && (
            <>
              <Switch label="Sound on new payment" checked={prefs.sound} onChange={(on) => toggle('sound', on)} />
              <Switch label="Vibrate on new payment" checked={prefs.vibrate} onChange={(on) => toggle('vibrate', on)} />
            </>
          )}
          <Switch
            label="High contrast"
            checked={prefs.highContrast}
            onChange={(on) => toggle('highContrast', on)}
          />
          {speechOk && (
            <Switch label="Read results aloud" checked={prefs.readAloud} onChange={(on) => toggle('readAloud', on)} />
          )}
        </div>
      )}
    </div>
  )
}

// A native checkbox with switch semantics; the track and knob are drawn from
// its state with peer classes, so keyboard and screen readers get the real
// control.
function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-[3.25rem] cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2">
      <span className="text-lg text-brand-dark">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-8 w-14 rounded-full bg-brand-dark/25 transition-colors duration-150 peer-checked:bg-route peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-route"
        />
        <span
          aria-hidden="true"
          className="switch-knob absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(26,26,46,0.3)] peer-checked:translate-x-6"
        />
      </span>
    </label>
  )
}
