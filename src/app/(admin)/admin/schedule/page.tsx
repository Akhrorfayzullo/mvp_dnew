import { createServiceClient } from '@/lib/supabase/server'
import ScheduleManager from '@/components/admin/ScheduleManager'
import { CalendarDays } from 'lucide-react'

export default async function SchedulePage() {
  const supabase = await createServiceClient()

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, specialty')
    .order('name', { ascending: true })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">진료일정 관리</h1>
          <p className="text-sm text-muted-foreground">병원별 진료 스케줄 및 의사 시간표 관리</p>
        </div>
      </div>

      <ScheduleManager orgs={orgs ?? []} />
    </div>
  )
}
