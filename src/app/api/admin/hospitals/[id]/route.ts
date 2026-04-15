import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { name, specialty, plan_type, credit_balance, email } = body

  if (!name) {
    return NextResponse.json({ error: '병원명은 필수입니다.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // If email changed, update auth user too
  if (email) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('org_id', id)
      .eq('role', 'owner')
      .single()

    if (userRow?.id) {
      await supabase.auth.admin.updateUserById(userRow.id, { email })
      await supabase.from('users').update({ email }).eq('id', userRow.id)
    }
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      specialty: specialty || '기타',
      plan_type: plan_type || 'lite',
      credit_balance: credit_balance ?? 0,
      ...(email ? { email } : {}),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

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
