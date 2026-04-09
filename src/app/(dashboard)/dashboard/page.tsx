import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, ShieldCheck, AlertTriangle, TrendingUp, Calendar } from 'lucide-react'
import DashboardChart from '@/components/dashboard/DashboardChart'
import AlertsList from '@/components/dashboard/AlertsList'
import RecentContents from '@/components/dashboard/RecentContents'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  let org = null
  let alerts: Array<{id: string; type: string; severity: string; message: string; is_read: boolean; created_at: string}> = []

  if (userData?.org_id) {
    const { data } = await supabase.from('organizations').select('*').eq('id', userData.org_id).single()
    org = data

    const { data: alertsData } = await supabase
      .from('monitoring_alerts')
      .select('*')
      .eq('org_id', userData.org_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)
    alerts = alertsData || []
  }

  const kpis = [
    { label: '이번달 생성 콘텐츠', value: '24', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '광고 적합성 점수', value: '87점', icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '네이버 플레이스 순위', value: '#3', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: '활성 알림', value: String(alerts.length), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div>
      <TopBar
        title={`안녕하세요, ${org?.name ?? '병원'}님 👋`}
        subtitle={today}
        alertCount={alerts.length}
      />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <Card key={kpi.label} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Chart + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DashboardChart />
          </div>
          <div>
            <AlertsList alerts={alerts} />
          </div>
        </div>

        {/* Recent Content + Upcoming Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentContents orgId={userData?.org_id ?? ''} />
          </div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0F6E56]" />
                예정된 작업
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { task: '블로그 포스트 발행', date: '오늘', status: 'urgent' },
                  { task: '인스타그램 카드뉴스', date: '내일', status: 'normal' },
                  { task: '월간 성과 리포트', date: '이번 주', status: 'normal' },
                  { task: '경쟁사 분석 업데이트', date: '다음 주', status: 'low' },
                ].map((item) => (
                  <div key={item.task} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <p className="text-sm text-gray-700">{item.task}</p>
                    <Badge variant={item.status === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                      {item.date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
