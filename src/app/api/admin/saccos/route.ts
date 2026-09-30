import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'

// Saccos for the admin pickers, with their vehicles (for assigning owners).
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('saccos').select('id, name, vehicles(id, vehicle_code)').order('name')
  if (error) return NextResponse.json({ error: 'Could not load saccos' }, { status: 500 })
  return NextResponse.json({
    saccos: (data ?? []).map((s: any) => {
      const vehicles = (s.vehicles ?? [])
        .map((v: any) => ({ id: v.id, vehicleCode: v.vehicle_code }))
        .sort((a: any, b: any) => a.vehicleCode.localeCompare(b.vehicleCode))
      return { id: s.id, name: s.name, vehicleCount: vehicles.length, vehicles }
    }),
  })
}
