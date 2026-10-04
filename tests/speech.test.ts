import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canSpeak, payInstruction, paymentResultMessage, primeSpeech, speak, spellOut } from '@/lib/speech'

// jsdom has no Web Speech API, so stand in a minimal one.
class FakeUtterance {
  voice: unknown = null
  lang = ''
  rate = 1
  volume = 1
  constructor(public text: string) {}
}
const synth = {
  speaking: false,
  pending: false,
  speak: vi.fn(),
  cancel: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { lang: 'en-US', localService: true, name: 'US' },
    { lang: 'en-KE', localService: true, name: 'Kenya' },
  ]),
}

function installSpeech() {
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
}
const spoken = () => synth.speak.mock.calls.map(([u]) => (u as FakeUtterance).text)

beforeEach(() => {
  synth.speak.mockClear()
  synth.cancel.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('speech availability', () => {
  it('is unavailable without the Web Speech API, and speaking is then a no-op', () => {
    expect(canSpeak()).toBe(false)
    expect(() => speak('hello')).not.toThrow()
    expect(() => primeSpeech('hello')).not.toThrow()
  })
})

describe('speak', () => {
  beforeEach(installSpeech)

  it('reads text aloud by default, preferring a Kenyan English voice', () => {
    speak('Payment successful.')
    expect(spoken()).toEqual(['Payment successful.'])
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(u.lang).toBe('en-KE')
    expect(u.rate).toBe(0.95)
  })

  it('stays quiet when "Read results aloud" is off', () => {
    localStorage.setItem('safaripap.readAloud', 'off')
    speak('Payment successful.')
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('"Read again" speaks even with the setting off', () => {
    localStorage.setItem('safaripap.readAloud', 'off')
    speak('Payment successful.', { force: true, fromTap: true })
    expect(spoken()).toEqual(['Payment successful.'])
  })

  it('waits until the page is visible again (M-Pesa PIN screen on top)', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    speak('Payment successful.')
    expect(synth.speak).not.toHaveBeenCalled()
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(spoken()).toEqual(['Payment successful.'])
  })
})

describe('primeSpeech', () => {
  beforeEach(installSpeech)

  it('speaks the instruction inside the tap', () => {
    primeSpeech(payInstruction(false))
    expect(spoken()).toEqual(['Check your phone and enter your M-Pesa PIN.'])
  })

  it('still unlocks speech, silently, when reading aloud is off', () => {
    localStorage.setItem('safaripap.readAloud', 'off')
    primeSpeech(payInstruction(false))
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(u.text).toBe(' ')
    expect(u.volume).toBe(0)
  })
})

describe('payment messages', () => {
  it('spells out digits so they are read one by one', () => {
    expect(spellOut('149')).toBe('1 4 9')
  })

  it('tells the passenger what to say to the conductor', () => {
    expect(
      paymentResultMessage({ paid: true, amountKes: 50, phoneLast3: '678', receiptLast3: 'F3K' }, 'KAB123B', false)
    ).toBe('Payment successful. 50 shillings paid to KAB123B. Tell the conductor: phone ending 6 7 8. Receipt ending F 3 K.')
  })

  it('tells a conductor who prompted the passenger', () => {
    expect(paymentResultMessage({ paid: true, amountKes: 70, phoneLast3: '678' }, 'KAB123B', true)).toBe(
      'Passenger paid 70 shillings. Phone ending 6 7 8.'
    )
    expect(payInstruction(true)).toBe('Sending the M-Pesa prompt to the passenger.')
  })

  it('reassures that no money was taken on failure', () => {
    expect(paymentResultMessage({ paid: false, amountKes: 50 }, 'KAB123B', false)).toBe(
      'Payment not completed. No money was taken.'
    )
  })
})
