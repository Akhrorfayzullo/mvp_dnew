import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer) })
  })
}

async function findUserByEmail(email: string) {
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  return users.find((u) => u.email === email) ?? null
}

async function createAuthUser(email: string, password: string, role: string) {
  const existing = await findUserByEmail(email)
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id)
    console.log(`  🗑  Removed existing auth user: ${email}`)
    await new Promise((r) => setTimeout(r, 800))
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })

  if (error) throw new Error(`Auth error for ${email}: ${error.message}`)
  return data.user
}

async function seed() {
  console.log('\n🌱 DNEW AI Platform — Seed Script')
  console.log('=====================================\n')

  // ── Step 0: Require trigger fix ─────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PREREQUISITE: Fix the auth trigger')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nRun this SQL in Supabase SQL Editor:')
  console.log('👉 https://supabase.com/dashboard/project/tkbuaqarhszdbryyothb/sql/new\n')
  console.log('─────────────────────────────────────────────────────────────────')
  console.log(`CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'owner'))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role  = EXCLUDED.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;`)
  console.log('─────────────────────────────────────────────────────────────────\n')

  const answer = await prompt('Have you run the SQL above? (y/n): ')
  if (answer.toLowerCase() !== 'y') {
    console.log('\n⏸  Please run the SQL first, then run this script again.')
    process.exit(0)
  }

  console.log('\n✅ Proceeding with seed...\n')

  // ── 1. Super Admin ──────────────────────────────────────────────────────────
  console.log('1️⃣  Creating Super Admin...')
  const adminUser = await createAuthUser('admin@dnew.co.kr', 'Admin1234!', 'superadmin')

  await supabase.from('users').upsert(
    { id: adminUser.id, email: 'admin@dnew.co.kr', role: 'superadmin', org_id: null },
    { onConflict: 'id' }
  )
  // Ensure role is correct even if trigger set it differently
  await supabase.from('users').update({ role: 'superadmin', org_id: null }).eq('id', adminUser.id)

  console.log('  ✅ Super Admin created')
  console.log(`     ID   : ${adminUser.id}`)
  console.log(`     Email: admin@dnew.co.kr`)
  console.log(`     Pass : Admin1234!\n`)

  // ── 2. Hospital Org ─────────────────────────────────────────────────────────
  console.log('2️⃣  Creating Hospital Organization...')

  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', '힐링피부과의원')
    .maybeSingle()

  if (existingOrg) {
    await supabase.from('organizations').delete().eq('id', existingOrg.id)
    console.log('  🗑  Removed existing org')
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: '힐링피부과의원',
      specialty: '피부과',
      treatments: ['보톡스', '필러', '레이저 토닝', '리프팅', '여드름 치료', '색소 치료'],
      phone: '02-555-1234',
      address: '서울시 강남구 테헤란로 123',
      website_url: 'https://healing-skin.co.kr',
      plan_type: 'pro',
      credit_balance: 2000,
      design_style: 'modern',
      brand_color: '#0F6E56',
    })
    .select()
    .single()

  if (orgErr) throw new Error(`Org insert failed: ${orgErr.message}`)
  console.log(`  ✅ 힐링피부과의원 created (Pro · 2000 credits)\n`)

  // ── 3. Hospital Owner ───────────────────────────────────────────────────────
  console.log('3️⃣  Creating Hospital Owner...')
  const ownerUser = await createAuthUser('hospital@dnew.co.kr', 'Hospital1234!', 'owner')

  await supabase.from('users').upsert(
    { id: ownerUser.id, email: 'hospital@dnew.co.kr', role: 'owner', org_id: org.id },
    { onConflict: 'id' }
  )
  await supabase.from('users').update({ role: 'owner', org_id: org.id }).eq('id', ownerUser.id)

  console.log('  ✅ Hospital Owner created')
  console.log(`     ID   : ${ownerUser.id}`)
  console.log(`     Email: hospital@dnew.co.kr`)
  console.log(`     Pass : Hospital1234!`)
  console.log(`     Org  : 힐링피부과의원\n`)

  // ── 4. Monitoring Alerts ────────────────────────────────────────────────────
  console.log('4️⃣  Seeding monitoring alerts...')
  await supabase.from('monitoring_alerts').delete().eq('org_id', org.id)
  await supabase.from('monitoring_alerts').insert([
    { org_id: org.id, type: 'rank_drop',       severity: 'warning',  message: '"강남 피부과 보톡스" 키워드 순위 5위 → 8위 하락 감지',            is_read: false },
    { org_id: org.id, type: 'negative_review', severity: 'critical', message: '네이버 플레이스 부정 리뷰 1건 등록 (별점 1점) — 즉각 대응 필요', is_read: false },
    { org_id: org.id, type: 'popup_expired',   severity: 'info',     message: '네이버 스마트플레이스 팝업 이벤트 만료 예정 (D-3)',                is_read: false },
  ])
  console.log('  ✅ 3 alerts created\n')

  // ── 5. Credit Transactions ──────────────────────────────────────────────────
  console.log('5️⃣  Seeding credit transactions...')
  await supabase.from('credit_transactions').insert([
    { org_id: org.id, amount:  2000, type: 'monthly_grant', description: 'Pro 플랜 월간 크레딧 지급' },
    { org_id: org.id, amount:   -10, type: 'usage',         description: '블로그 포스트 생성' },
    { org_id: org.id, amount:    -3, type: 'usage',         description: '광고 적합성 검사' },
  ])
  console.log('  ✅ 3 transactions created\n')

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log('=====================================')
  console.log('✅ Seed complete!\n')
  console.log('┌─────────────────────────────────────────────┐')
  console.log('│  Super Admin                                 │')
  console.log('│  Email   : admin@dnew.co.kr                 │')
  console.log('│  Password: Admin1234!                        │')
  console.log('│  Redirect: /admin                            │')
  console.log('├─────────────────────────────────────────────┤')
  console.log('│  Hospital Owner                              │')
  console.log('│  Email   : hospital@dnew.co.kr              │')
  console.log('│  Password: Hospital1234!                     │')
  console.log('│  Redirect: /dashboard                        │')
  console.log('└─────────────────────────────────────────────┘\n')
  console.log('Now login at: http://localhost:3000/login\n')
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
