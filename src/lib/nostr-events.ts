// Safaripap's public Nostr record: what the events look like and how a daily
// report's hash is computed. No secrets and no Node APIs, so the browser (the
// /verify page) recomputes exactly what the server signed.
//
// Two kinds of event, both NIP-78 application data (kind 30078): addressable
// by their 'd' tag, so re-publishing replaces instead of duplicating, and
// they stay out of people's social feeds (unlike kind 1 notes).
//   - Fare: one per paid fare. Amount and vehicle only: never the M-Pesa
//     receipt or phone digits, which are what a passenger shows as proof.
//   - Daily report (ported from Nauli Sacco): one per vehicle per Nairobi day,
//     carrying the totals and a SHA-256 hash of the day's fare list, so anyone
//     can check later that the numbers weren't changed.

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'

export const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net']
export const APP_DATA_KIND = 30078
// Relays only index single-letter tags, so readers filter by 't' and 'd'.
export const FARE_TOPIC = 'safaripap-fare'
export const REPORT_TOPIC = 'safaripap-report'

export const fareAddress = (txId: string) => `safaripap:fare:${txId}`
export const reportAddress = (vehicleCode: string, date: string) => `safaripap:report:${vehicleCode}:${date}`

export interface EventTemplate {
  kind: number
  created_at: number
  tags: string[][]
  content: string
}

export interface FareEventInput {
  txId: string
  vehicleCode: string
  saccoId: string
  amountKes: number
  // A demo-phone fare (no real money): tagged so the public record never
  // passes it off as a real payment.
  demo?: boolean
}

export function fareEvent(input: FareEventInput, createdAt = Math.floor(Date.now() / 1000)): EventTemplate {
  return {
    kind: APP_DATA_KIND,
    created_at: createdAt,
    tags: [
      ['d', fareAddress(input.txId)],
      ['t', FARE_TOPIC],
      ['vehicle', input.vehicleCode],
      ['sacco', input.saccoId],
      ...(input.demo ? [['demo', 'true']] : []),
    ],
    content: JSON.stringify({
      amount_kes: input.amountKes,
      vehicle: input.vehicleCode,
      ...(input.demo ? { demo: true } : {}),
    }),
  }
}

// One paid fare as it goes into a daily report's hash. No phone digits; the
// last 3 receipt characters let a passenger find their own fare.
export interface ReportFare {
  id: string
  amount_kes: number
  receipt_last3: string | null
  status: string
}

/** The canonical list: sorted by id, fixed field order. Both sides hash exactly this. */
export function canonicalFares(fares: ReportFare[]): string {
  const list = [...fares]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((f) => [f.id, f.amount_kes, f.receipt_last3 ?? '', f.status])
  return JSON.stringify(list)
}

export function faresHash(fares: ReportFare[]): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalFares(fares))))
}

export interface ReportInput {
  vehicleCode: string
  saccoId: string
  date: string // YYYY-MM-DD, Nairobi
  fares: ReportFare[]
  sats: number // settled to the vehicle by the treasury
}

export function reportEvent(input: ReportInput, createdAt = Math.floor(Date.now() / 1000)): EventTemplate {
  const kes = input.fares.reduce((s, f) => s + f.amount_kes, 0)
  const hash = faresHash(input.fares)
  return {
    kind: APP_DATA_KIND,
    created_at: createdAt,
    tags: [
      ['d', reportAddress(input.vehicleCode, input.date)],
      ['t', REPORT_TOPIC],
      ['vehicle', input.vehicleCode],
      ['sacco', input.saccoId],
      ['date', input.date],
      ['hash', hash],
    ],
    content: JSON.stringify({
      vehicle: input.vehicleCode,
      date: input.date,
      fares: input.fares.length,
      kes,
      sats: input.sats,
      hash,
      algorithm: 'sha256 of JSON [[id, amount_kes, receipt_last3, status], ...] sorted by id',
    }),
  }
}

export const tagValue = (tags: string[][], name: string) => tags.find((t) => t[0] === name)?.[1]
