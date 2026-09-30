// Resolves the sacco member making an API request from their Supabase access
// token (Authorization: Bearer …). Server-only.
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { getMember, type Member } from './members'

export async function memberFromRequest(req: NextRequest): Promise<Member | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data } = await supabaseAdmin.auth.getUser(token)
  if (!data.user) return null
  return getMember(supabaseAdmin, data.user.id)
}
