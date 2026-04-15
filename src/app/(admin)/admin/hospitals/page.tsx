import { createServiceClient } from '@/lib/supabase/server'
import HospitalManager, { type HospitalRow } from '@/components/admin/HospitalManager'

export const dynamic = 'force-dynamic'

export default async function HospitalsPage() {
  const supabase = await createServiceClient()

  const [{ data: orgs }, { data: reqStats }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, specialty, plan_type, credit_balance, email, telegram_verified, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('requests').select('org_id, status'),
  ])

  // Priority: in_progress > pending > completed > none
  const summaryMap = new Map<string, 'pending' | 'in_progress' | 'completed'>()
  for (const r of (reqStats ?? []) as { org_id: string; status: string }[]) {
    const current = summaryMap.get(r.org_id)
    if (r.status === 'in_progress') {
      summaryMap.set(r.org_id, 'in_progress')
    } else if (r.status === 'pending' && current !== 'in_progress') {
      summaryMap.set(r.org_id, 'pending')
    } else if (r.status === 'completed' && !current) {
      summaryMap.set(r.org_id, 'completed')
    }
  }

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
    request_summary: (summaryMap.get(o.id) ?? 'none') as 'none' | 'pending' | 'in_progress' | 'completed',
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <HospitalManager initial={hospitals} />
    </div>
  )
}
