// Alerts for the conductor dashboard when a fare is paid. Browsers only allow
// sound and the notification permission prompt after the user has tapped
// something, so enableFareAlerts() must be called from a click handler.

let audioCtx: AudioContext | null = null
let swRegistration: ServiceWorkerRegistration | null = null

export async function enableFareAlerts(): Promise<void> {
  audioCtx ??= new AudioContext()
  await audioCtx.resume()

  if ('Notification' in window && 'serviceWorker' in navigator) {
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    if (Notification.permission === 'default') await Notification.requestPermission()
  }
}

export function fareAlertsEnabled(): boolean {
  return audioCtx?.state === 'running'
}

// A short two-note chime, generated so there's no audio file to ship.
function playChime() {
  if (!audioCtx || audioCtx.state !== 'running') return
  const start = audioCtx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const osc = audioCtx!.createOscillator()
    const gain = audioCtx!.createGain()
    const t = start + i * 0.15
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.connect(gain).connect(audioCtx!.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
}

// Only when the dashboard is in the background; on screen the toast and
// chime already cover it.
function showNotification(amountKes: number) {
  if (!swRegistration || !document.hidden || Notification.permission !== 'granted') return
  swRegistration.showNotification(`Paid: KES ${amountKes}`, {
    body: 'Tap to open the dashboard',
    tag: 'fare-paid',
    renotify: true,
    data: { url: window.location.pathname },
  } as NotificationOptions)
}

export function alertFarePaid(amountKes: number) {
  playChime()
  navigator.vibrate?.([200, 100, 200]) // Android only; iOS ignores it
  showNotification(amountKes)
}
