import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { password } = await req.json()

  if (!password || password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', id)
    .eq('role', 'owner')
    .single()

  if (!userRow?.id) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { error } = await supabase.auth.admin.updateUserById(userRow.id, { password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
