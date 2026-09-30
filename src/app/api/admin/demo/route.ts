import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'
import { clearDemo, generateDemo, validateDemoInput } from '@/lib/demo-data'

// Generating a few thousand fares takes a while; allow it the time.
export const maxDuration = 60

// GET: how many demo matatus each sacco has. POST: add demo matatus with
// history. DELETE ?saccoId=: remove a sacco's demo matatus and their fares.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('vehicles').select('sacco_id, vehicle_code').eq('is_demo', true)
  if (error) {
    return NextResponse.json(
      { error: 'Could not read demo data. Has the 20261001_demo_data.sql migration been run?' },
      { status: 500 }
    )
  }
  const bySacco: Record<string, string[]> = {}
  for (const v of data ?? []) (bySacco[v.sacco_id] ??= []).push(v.vehicle_code)
  return NextResponse.json({ bySacco })
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const input = { saccoId: String(body?.saccoId ?? ''), vehicles: Number(body?.vehicles), days: Number(body?.days) }
  const invalid = validateDemoInput(input)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  try {
    return NextResponse.json(await generateDemo(supabaseAdmin, input))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const saccoId = req.nextUrl.searchParams.get('saccoId')
  if (!saccoId) return NextResponse.json({ error: 'Choose a sacco.' }, { status: 400 })
  try {
    return NextResponse.json(await clearDemo(supabaseAdmin, saccoId))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
