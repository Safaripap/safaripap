// Per-device preferences, kept in localStorage. Every read and write is
// wrapped: private browsing and some WebViews throw on localStorage access,
// and the app must still work with the defaults.

export type Preference = 'sound' | 'vibrate' | 'highContrast' | 'readAloud' | 'largeText'

const KEYS: Record<Preference, string> = {
  sound: 'safaripap.sound',
  vibrate: 'safaripap.vibrate',
  highContrast: 'safaripap.highContrast',
  readAloud: 'safaripap.readAloud',
  largeText: 'safaripap.largeText',
}

// Sound and vibration default to on, matching how alerts behaved before
// these settings existed. Reading results aloud defaults on too, so a
// passenger who can't see the screen still hears the result. High contrast
// and larger text are opt-in.
const DEFAULTS: Record<Preference, boolean> = {
  sound: true,
  vibrate: true,
  highContrast: false,
  readAloud: true,
  largeText: false,
}

export function getPreference(pref: Preference): boolean {
  try {
    const v = localStorage.getItem(KEYS[pref])
    return v === null ? DEFAULTS[pref] : v === 'on'
  } catch {
    return DEFAULTS[pref]
  }
}

export function setPreference(pref: Preference, on: boolean) {
  try {
    localStorage.setItem(KEYS[pref], on ? 'on' : 'off')
  } catch {
    // Not persisted, but still applied for this visit.
  }
  if (pref === 'highContrast') applyHighContrast(on)
  if (pref === 'largeText') applyLargeText(on)
}

export function applyHighContrast(on: boolean) {
  if (on) document.documentElement.dataset.contrast = 'high'
  else delete document.documentElement.dataset.contrast
}

// Larger text (ported from Nauli Sacco): every rem-based size scales up.
export function applyLargeText(on: boolean) {
  if (on) document.documentElement.dataset.text = 'large'
  else delete document.documentElement.dataset.text
}

// Inlined in <head> so high contrast and larger text are on before first
// paint, not after hydration.
export const DISPLAY_BOOT_SCRIPT = `try{var d=document.documentElement;if(localStorage.getItem('${KEYS.highContrast}')==='on')d.dataset.contrast='high';if(localStorage.getItem('${KEYS.largeText}')==='on')d.dataset.text='large'}catch(e){}`
