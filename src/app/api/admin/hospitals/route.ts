import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, specialty, email, password, plan_type, credit_balance, phone, address } = body

  if (!name || !email || !password) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Check email not already used
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 400 })
  }

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? '사용자 생성에 실패했습니다.' },
      { status: 400 }
    )
  }

  // 2. Insert into organizations
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      specialty: specialty || '기타',
      email,
      plan_type: plan_type || 'lite',
      credit_balance: credit_balance ?? 500,
      phone: phone || null,
      address: address || null,
      telegram_verified: false,
    })
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('[hospitals POST] org insert error:', orgError)
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: orgError?.message ?? '병원 생성에 실패했습니다.' },
      { status: 500 }
    )
  }

  // 3. Upsert into users table (trigger may have already created the row)
  const { error: userError } = await supabase.from('users').upsert({
    id: authData.user.id,
    org_id: org.id,
    email,
    role: 'owner',
  }, { onConflict: 'id' })

  if (userError) {
    console.error('[hospitals POST] users insert error:', userError)
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('organizations').delete().eq('id', org.id)
    return NextResponse.json(
      { error: userError.message ?? '사용자 등록에 실패했습니다.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, org_id: org.id })
}
