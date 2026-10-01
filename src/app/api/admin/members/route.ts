import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'
import { createMember, validateMemberInput, type MemberInput } from '@/lib/members'

// GET: every sacco manager and matatu owner, with their sacco and (for
// owners) vehicles. POST: create one; the response carries their PIN once.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('sacco_members')
    .select('user_id, role, full_name, phone, sacco_id, created_at, saccos(name), vehicle_owners(vehicles(vehicle_code))')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load people' }, { status: 500 })
  return NextResponse.json({
    members: (data ?? []).map((m: any) => ({
      userId: m.user_id,
      role: m.role,
      fullName: m.full_name,
      phone: m.phone,
      saccoId: m.sacco_id,
      saccoName: m.saccos?.name ?? '',
      vehicleCodes: (m.vehicle_owners ?? []).map((o: any) => o.vehicles?.vehicle_code).filter(Boolean).sort(),
    })),
  })
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const input: MemberInput = {
    role: body?.role,
    fullName: String(body?.fullName ?? ''),
    phone: String(body?.phone ?? ''),
    saccoId: String(body?.saccoId ?? ''),
    vehicleIds: Array.isArray(body?.vehicleIds) ? body.vehicleIds.map(String) : [],
  }
  const invalid = validateMemberInput(input)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  try {
    return NextResponse.json(await createMember(supabaseAdmin, input))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 })
  }
}
