import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'

// PATCH { status: 'new' | 'done' | 'dismissed' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { status } = (await req.json().catch(() => ({}))) as { status?: string }
  if (status !== 'new' && status !== 'done' && status !== 'dismissed') {
    return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('onboarding_requests')
    .update({ status, handled_at: status === 'new' ? null : new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Could not update the request' }, { status: 500 })
  return NextResponse.json({ status })
}
