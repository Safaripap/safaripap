import { beforeEach, describe, expect, it, vi } from 'vitest'

// A minimal AudioContext stand-in that records how many oscillators the
// chime creates.
class FakeAudioContext {
  static oscillators = 0
  state = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => {})
  createOscillator() {
    FakeAudioContext.oscillators++
    return { frequency: { value: 0 }, connect: (n: any) => n, start() {}, stop() {} }
  }
  createGain() {
    const node = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: any) => n }
    return node
  }
}

let alerts: typeof import('@/lib/fare-alerts')
const vibrate = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  FakeAudioContext.oscillators = 0
  vibrate.mockClear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  alerts = await import('@/lib/fare-alerts')
  await alerts.enableFareAlerts()
})

describe('alertFarePaid', () => {
  it('chimes and vibrates by default', () => {
    alerts.alertFarePaid(60)
    expect(FakeAudioContext.oscillators).toBe(2)
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('stays silent when sound is turned off', () => {
    localStorage.setItem('safaripap.sound', 'off')
    alerts.alertFarePaid(60)
    expect(FakeAudioContext.oscillators).toBe(0)
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('does not vibrate when vibration is turned off', () => {
    localStorage.setItem('safaripap.vibrate', 'off')
    alerts.alertFarePaid(60)
    expect(FakeAudioContext.oscillators).toBe(2)
    expect(vibrate).not.toHaveBeenCalled()
  })
})
