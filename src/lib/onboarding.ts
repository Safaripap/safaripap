// Onboarding a vehicle end to end: sacco, LNbits wallet, Lightning Address,
// vehicle row, conductor login. Shared by the /admin/onboard flow and the
// scripts/ CLI, so both behave the same. Imports are relative so `tsx` can run
// it from scripts/ without path aliases.

import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { conductorEmail, PIN_LENGTH } from './conductor'
import { createLnurlpLink, createWallet, deleteLnurlpLink, lightningAddressFor, type LnbitsWallet } from './lnbits'

import { STEPS, type StepId } from './onboarding-steps'
export { STEPS, type StepId }

export type StepEvent =
  | { type: 'step'; step: StepId; status: 'running' | 'done'; detail?: string }
  | { type: 'failed'; step: StepId; error: string }

export interface OnboardInput {
  vehicleCode: string
  conductorName: string
  presetFareKes?: number | null
  saccoId?: string | null
  newSaccoName?: string | null
  pin?: string // generated when omitted
}

export interface OnboardResult {
  vehicleCode: string
  vehicleId: string
  saccoId: string
  saccoName: string
  lightningAddress: string
  walletName: string
  pin: string
}

// Kenyan plates look like KAB 123B; accept any 4–10 letters/digits.
export function normalizeVehicleCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function validateOnboardInput(input: OnboardInput): string | null {
  const code = normalizeVehicleCode(input.vehicleCode ?? '')
  if (code.length < 4 || code.length > 10) return 'Enter the vehicle plate, like KAB 123B.'
  if (!input.conductorName?.trim()) return "Enter the conductor's name."
  if (input.presetFareKes != null && (!Number.isInteger(input.presetFareKes) || input.presetFareKes < 10 || input.presetFareKes > 10000))
    return 'Preset fare must be a whole number of shillings between 10 and 10,000.'
  if (!input.saccoId && !input.newSaccoName?.trim()) return 'Choose a sacco or enter a new sacco name.'
  if (input.pin != null && !new RegExp(`^\\d{${PIN_LENGTH}}$`).test(input.pin)) return `PIN must be ${PIN_LENGTH} digits.`
  return null
}

export function generatePin(): string {
  return Array.from({ length: PIN_LENGTH }, () => randomInt(0, 10)).join('')
}

// Creates the conductor's Supabase Auth login for a vehicle (or resets its PIN
// if it already has one) and links it to the vehicle.
export async function createConductorLogin(
  supabase: SupabaseClient,
  vehicle: { id: string; conductor_user_id?: string | null },
  vehicleCode: string,
  pin: string
): Promise<{ userId: string; created: boolean }> {
  if (vehicle.conductor_user_id) {
    const { error } = await supabase.auth.admin.updateUserById(vehicle.conductor_user_id, { password: pin })
    if (error) throw error
    return { userId: vehicle.conductor_user_id, created: false }
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: conductorEmail(vehicleCode),
    password: pin,
    email_confirm: true,
    user_metadata: { vehicle_code: vehicleCode },
  })
  if (error) throw error
  const { error: linkError } = await supabase.from('vehicles').update({ conductor_user_id: data.user.id }).eq('id', vehicle.id)
  if (linkError) {
    await supabase.auth.admin.deleteUser(data.user.id)
    throw linkError
  }
  return { userId: data.user.id, created: true }
}

// Runs every step, reporting progress through `onEvent`. If a step fails,
// everything created so far is undone (best effort) so a half-onboarded
// vehicle never exists, and the error is rethrown.
export async function onboardVehicle(
  supabase: SupabaseClient,
  input: OnboardInput,
  onEvent: (e: StepEvent) => void = () => {}
): Promise<OnboardResult> {
  const invalid = validateOnboardInput(input)
  if (invalid) throw new Error(invalid)

  const code = normalizeVehicleCode(input.vehicleCode)
  const pin = input.pin ?? generatePin()
  const undo: (() => PromiseLike<unknown>)[] = []
  let current: StepId = 'sacco'

  const start = (step: StepId) => {
    current = step
    onEvent({ type: 'step', step, status: 'running' })
  }
  const done = (step: StepId, detail?: string) => onEvent({ type: 'step', step, status: 'done', detail })

  try {
    // Refuse duplicates before creating anything.
    const { data: existing } = await supabase.from('vehicles').select('id').eq('vehicle_code', code).maybeSingle()
    if (existing) throw new Error(`${code} is already onboarded.`)

    start('sacco')
    let saccoId = input.saccoId ?? null
    let saccoName: string
    if (saccoId) {
      const { data, error } = await supabase.from('saccos').select('id, name').eq('id', saccoId).single()
      if (error || !data) throw new Error('That sacco no longer exists.')
      saccoName = data.name
    } else {
      const { data, error } = await supabase
        .from('saccos')
        .insert({ name: input.newSaccoName!.trim() })
        .select('id, name')
        .single()
      if (error || !data) throw new Error(`Couldn't create the sacco: ${error?.message}`)
      saccoId = data.id as string
      saccoName = data.name
      undo.push(() => supabase.from('saccos').delete().eq('id', data.id))
    }
    done('sacco', saccoName)

    start('wallet')
    const walletName = `${code} fares`
    const wallet: LnbitsWallet = await createWallet(walletName)
    // LNbits wallets can't be deleted through the API; an empty orphan wallet
    // is harmless and can be removed from the LNbits admin UI.
    done('wallet', walletName)

    start('address')
    const username = code.toLowerCase()
    const link = await createLnurlpLink(wallet, { description: `${code} fare payments`, username })
    undo.push(() => deleteLnurlpLink(wallet, link.id))
    const lightningAddress = lightningAddressFor(link.username ?? username)
    done('address', lightningAddress)

    start('vehicle')
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .insert({
        vehicle_code: code,
        conductor_name: input.conductorName.trim(),
        sacco_id: saccoId,
        preset_fare_kes: input.presetFareKes ?? null,
        lnbits_wallet_id: wallet.id,
        lnbits_invoice_key: wallet.inkey,
        lightning_address: lightningAddress,
      })
      .select('id')
      .single()
    if (vehicleError || !vehicle) throw new Error(`Couldn't save the vehicle: ${vehicleError?.message}`)
    undo.push(() => supabase.from('vehicles').delete().eq('id', vehicle.id))
    done('vehicle', code)

    start('conductor')
    await createConductorLogin(supabase, { id: vehicle.id }, code, pin)
    done('conductor', input.conductorName.trim())

    return { vehicleCode: code, vehicleId: vehicle.id, saccoId: saccoId!, saccoName, lightningAddress, walletName, pin }
  } catch (err: any) {
    onEvent({ type: 'failed', step: current, error: err?.message ?? String(err) })
    for (const fn of undo.reverse()) await Promise.resolve(fn()).catch(() => {})
    throw err
  }
}
