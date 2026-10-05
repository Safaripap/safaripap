// Spoken payment instructions and results, read aloud with the browser's own
// speech synthesis (Web Speech API, no library, nothing sent anywhere).
// Ported from Nauli Sacco's lib/feedback.ts. Respects the "Read results
// aloud" setting, which defaults on so a passenger who can't see the screen
// still hears the result.

import { getPreference } from './preferences'

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** Best installed English voice: Kenyan English, then any English, else the browser default. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.toLowerCase() === 'en-ke') ??
    voices.find((v) => /^en[-_](gb|us|za|ng|in)/i.test(v.lang) && v.localService) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null
  )
}

function say(text: string, sync = false): void {
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  } else {
    u.lang = 'en-GB'
  }
  u.rate = 0.95
  const busy = synth.speaking || synth.pending
  if (busy) synth.cancel()
  const go = () => {
    synth.resume() // Chrome on Android sometimes leaves the queue paused
    synth.speak(u)
  }
  // Inside a tap, iOS needs speak() in the same task. Otherwise Chrome can drop an
  // utterance queued in the same tick as cancel(), so wait a moment after cancelling.
  if (sync || !busy) go()
  else setTimeout(go, 60)
}

/**
 * Read text aloud. `force` ignores the preference (an explicit "Read again" tap).
 * Phones only allow speech after the person has tapped something on the page,
 * so the Pay tap speaks first (primeSpeech) and later results can follow.
 * If the page is hidden (M-Pesa PIN screen on top), wait until it's visible.
 */
export function speak(text: string, opts: { force?: boolean; fromTap?: boolean } = {}): void {
  if (!canSpeak() || (!opts.force && !getPreference('readAloud'))) return
  try {
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onVisible)
        say(text)
      }
      document.addEventListener('visibilitychange', onVisible)
      return
    }
    say(text, opts.fromTap)
  } catch {
    // speech unavailable
  }
}

/** Call inside a tap handler: unlocks speech for this page and loads the voice list. */
export function primeSpeech(text?: string): void {
  if (!canSpeak()) return
  try {
    window.speechSynthesis.getVoices()
    if (text && getPreference('readAloud')) {
      say(text, true)
    } else {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  } catch {
    // speech unavailable
  }
}

/** "149" → "1 4 9", so a screen reader or TTS reads digits, not "one hundred forty-nine". */
export function spellOut(s: string): string {
  return s.split('').join(' ')
}

/** What the Pay tap says: the instruction for what happens next. */
export function payInstruction(fromConductor: boolean): string {
  return fromConductor ? 'Sending the M-Pesa prompt to the passenger.' : 'Check your phone and enter your M-Pesa PIN.'
}

/** What gets read aloud / announced for a finished payment. */
export function paymentResultMessage(
  result: { paid: boolean; amountKes: number; phoneLast3?: string | null; receiptLast3?: string | null },
  vehicleCode: string,
  fromConductor: boolean
): string {
  if (result.paid) {
    const phone = result.phoneLast3 ? spellOut(result.phoneLast3) : ''
    const receipt = result.receiptLast3 ? ` Receipt ending ${spellOut(result.receiptLast3)}.` : ''
    return fromConductor
      ? `Passenger paid ${result.amountKes} shillings. Phone ending ${phone}.${receipt}`
      : `Payment successful. ${result.amountKes} shillings paid to ${vehicleCode}. Tell the conductor: phone ending ${phone}.${receipt}`
  }
  return 'Payment not completed. No money was taken.'
}
