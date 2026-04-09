'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Bell } from 'lucide-react'

interface Alert {
  id: string
  type: string
  severity: string
  message: string
  is_read: boolean
  created_at: string
}

const MOCK_ALERTS: Alert[] = [
  { id: '1', type: 'rank_drop', severity: 'warning', message: '네이버 플레이스 순위 3위 하락 감지', is_read: false, created_at: new Date().toISOString() },
  { id: '2', type: 'negative_review', severity: 'critical', message: '부정적 리뷰 1건 등록됨 - 즉각 대응 필요', is_read: false, created_at: new Date().toISOString() },
  { id: '3', type: 'popup_expired', severity: 'info', message: '팝업 광고 만료 예정 (3일 후)', is_read: false, created_at: new Date().toISOString() },
]

interface AlertsListProps {
  alerts: Alert[]
}

const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', label: '긴급' },
  warning: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '경고' },
  info: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: '정보' },
}

export default function AlertsList({ alerts }: AlertsListProps) {
  const displayAlerts = alerts.length > 0 ? alerts : MOCK_ALERTS

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0F6E56]" />
          오늘의 알림
          {displayAlerts.length > 0 && (
            <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs h-5">
              {displayAlerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">새로운 알림이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.info
              return (
                <div key={alert.id} className={`p-3 rounded-lg border text-xs ${config.color}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold">[{config.label}] </span>
                      {alert.message}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
