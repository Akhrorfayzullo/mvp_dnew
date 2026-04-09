'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

const data = [
  { month: '10월', 콘텐츠: 8, 광고적합성: 72 },
  { month: '11월', 콘텐츠: 14, 광고적합성: 78 },
  { month: '12월', 콘텐츠: 11, 광고적합성: 75 },
  { month: '1월', 콘텐츠: 18, 광고적합성: 82 },
  { month: '2월', 콘텐츠: 22, 광고적합성: 85 },
  { month: '3월', 콘텐츠: 24, 광고적합성: 87 },
]

export default function DashboardChart() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0F6E56]" />
          콘텐츠 생성 & 광고 적합성 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorContent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="콘텐츠" stroke="#0F6E56" fill="url(#colorContent)" strokeWidth={2} />
            <Area type="monotone" dataKey="광고적합성" stroke="#3B82F6" fill="url(#colorCompliance)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
