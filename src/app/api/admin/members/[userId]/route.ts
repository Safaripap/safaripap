import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'
import { removeMember, resetMemberPin } from '@/lib/members'

// PATCH: give this member a new PIN (returned once). DELETE: remove them.
// Only acts on real sacco members, never on conductor or other logins.
async function isMember(userId: string) {
  const { data } = await supabaseAdmin.from('sacco_members').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!(await isMember(params.userId))) return NextResponse.json({ error: 'No such member' }, { status: 404 })
  try {
    return NextResponse.json({ pin: await resetMemberPin(supabaseAdmin, params.userId) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { userId: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!(await isMember(params.userId))) return NextResponse.json({ error: 'No such member' }, { status: 404 })
  try {
    await removeMember(supabaseAdmin, params.userId)
    return NextResponse.json({ removed: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
