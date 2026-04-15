import { createServiceClient } from '@/lib/supabase/server'
import { Building2 } from 'lucide-react'
import HospitalManager, { type HospitalRow } from '@/components/admin/HospitalManager'

export const dynamic = 'force-dynamic'

export default async function HospitalsPage() {
  const supabase = await createServiceClient()

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, specialty, plan_type, credit_balance, email, telegram_verified, created_at')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hospitals: HospitalRow[] = (orgs ?? []).map((o: any) => ({
    id: o.id,
    name: o.name,
    specialty: o.specialty,
    plan_type: o.plan_type,
    credit_balance: o.credit_balance,
    email: o.email ?? null,
    telegram_verified: o.telegram_verified ?? false,
    created_at: o.created_at,
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            병원 관리
          </h1>
          <p className="text-sm text-muted-foreground">
            전체 {hospitals.length}개 병원 등록됨
          </p>
        </div>
      </div>

      <HospitalManager initial={hospitals} />
    </div>
  )
}
