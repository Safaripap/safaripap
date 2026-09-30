import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'

// Saccos for the onboarding form's picker, with how many vehicles each has.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('saccos').select('id, name, vehicles(count)').order('name')
  if (error) return NextResponse.json({ error: 'Could not load saccos' }, { status: 500 })
  return NextResponse.json({
    saccos: (data ?? []).map((s: any) => ({ id: s.id, name: s.name, vehicleCount: s.vehicles?.[0]?.count ?? 0 })),
  })
}
