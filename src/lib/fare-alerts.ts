// Alerts for the conductor dashboard when a fare is paid. Browsers only allow
// sound after the user has tapped something, so enableFareAlerts() must be
// called from a click handler.

let audioCtx: AudioContext | null = null

export async function enableFareAlerts(): Promise<void> {
  audioCtx ??= new AudioContext()
  await audioCtx.resume()
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

export function alertFarePaid(_amountKes: number) {
  playChime()
  navigator.vibrate?.([200, 100, 200]) // Android only; iOS ignores it
}
