import { createServiceClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, CreditCard, AlertTriangle } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createServiceClient()

  const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
  const { data: users } = await supabase.from('users').select('*').order('created_at', { ascending: false })
  const { data: alerts } = await supabase.from('monitoring_alerts').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(20)

  const totalOrgs = orgs?.length ?? 0
  const totalUsers = users?.length ?? 0
  const activeAlerts = alerts?.length ?? 0

  const kpis = [
    { label: '전체 병원', value: String(totalOrgs), icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '전체 사용자', value: String(totalUsers), icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '월 예상 매출', value: '₩2,400,000', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '미처리 알림', value: String(activeAlerts), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const planColor: Record<string, string> = {
    lite: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  }
  const planLabel: Record<string, string> = {
    lite: '라이트',
    pro: '프로',
    enterprise: '엔터프라이즈',
  }
  const roleLabel: Record<string, string> = {
    superadmin: '슈퍼관리자',
    owner: '원장',
    admin: '관리자',
    member: '직원',
    agent: '에이전트',
  }
  const severityLabel: Record<string, string> = {
    critical: '긴급',
    warning: '경고',
    info: '정보',
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">슈퍼관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground">전체 병원 및 사용자 현황</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospitals Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">병원 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {!orgs || orgs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                등록된 병원이 없습니다
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-100">
                {orgs.map((org) => (
                  <div key={org.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.specialty} · {org.phone || '전화번호 없음'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${planColor[org.plan_type] || planColor.lite}`} variant="outline">
                        {planLabel[org.plan_type] || org.plan_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{org.credit_balance} 크레딧</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">사용자 관리</CardTitle>
          </CardHeader>
          <CardContent>
            {!users || users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                등록된 사용자가 없습니다
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-100">
                {users.slice(0, 10).map((user) => (
                  <div key={user.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.email}</p>
                      <p className="text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <Badge variant={user.role === 'superadmin' ? 'destructive' : 'secondary'} className="text-xs">
                      {roleLabel[user.role] || user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              전체 미처리 알림
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  alert.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                  alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <span>{alert.message}</span>
                  <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">{severityLabel[alert.severity] || alert.severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
