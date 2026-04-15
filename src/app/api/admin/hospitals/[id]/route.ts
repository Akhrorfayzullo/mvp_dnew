import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServiceClient()

  // Get the org's auth user via users table
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', id)
    .eq('role', 'owner')
    .single()

  // Delete org (cascades to users row via FK if set, otherwise delete manually)
  await supabase.from('users').delete().eq('org_id', id)
  const { error } = await supabase.from('organizations').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Delete auth user last
  if (user?.id) {
    await supabase.auth.admin.deleteUser(user.id)
  }

  return NextResponse.json({ ok: true })
}
