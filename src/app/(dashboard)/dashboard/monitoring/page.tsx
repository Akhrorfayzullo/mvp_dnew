'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, TrendingUp, TrendingDown, Star, AlertTriangle, MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const MOCK_RANKINGS = [
  { keyword: '강남 피부과', rank: 3, change: +1, lastWeek: 4 },
  { keyword: '강남 레이저 토닝', rank: 7, change: -2, lastWeek: 5 },
  { keyword: '강남역 피부과 보톡스', rank: 2, change: 0, lastWeek: 2 },
  { keyword: '강남 여드름 치료', rank: 12, change: -5, lastWeek: 7 },
]

const MOCK_REVIEWS = [
  {
    id: '1',
    author: '박**',
    rating: 5,
    text: '친절하고 시술도 만족스러워요. 다음에 또 방문할게요!',
    sentiment: 'positive',
    date: '2시간 전',
  },
  {
    id: '2',
    author: '김**',
    rating: 2,
    text: '대기시간이 너무 길어요. 예약하고 1시간 이상 기다렸습니다.',
    sentiment: 'negative',
    date: '5시간 전',
  },
  {
    id: '3',
    author: '이**',
    rating: 4,
    text: '의사 선생님이 친절하게 설명해주셨어요. 시설도 깔끔합니다.',
    sentiment: 'positive',
    date: '1일 전',
  },
  {
    id: '4',
    author: '최**',
    rating: 1,
    text: '상담 후 갑자기 가격이 올라서 당황했어요. 투명한 가격 안내가 필요합니다.',
    sentiment: 'negative',
    date: '2일 전',
  },
]

const MOCK_ALERTS = [
  { id: '1', type: 'rank_drop', severity: 'warning', message: '"강남 레이저 토닝" 키워드 순위 7위로 2단계 하락', created_at: '1시간 전' },
  { id: '2', type: 'negative_review', severity: 'critical', message: '부정 리뷰 2건 등록 (평점 1-2점)', created_at: '5시간 전' },
  { id: '3', type: 'popup_expired', severity: 'info', message: '네이버 스마트플레이스 팝업 이벤트 만료 예정 (3일)', created_at: '1일 전' },
]

export default function MonitoringPage() {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [loadingReply, setLoadingReply] = useState<string | null>(null)

  async function generateReply(reviewId: string, reviewText: string) {
    setLoadingReply(reviewId)
    try {
      const res = await fetch('/api/monitoring/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: reviewText }),
      })
      const data = await res.json()
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: data.reply }))
      toast.success('AI 답변 초안이 생성되었습니다')
    } catch {
      toast.error('답변 생성 중 오류가 발생했습니다')
    } finally {
      setLoadingReply(null)
    }
  }

  const severityConfig: Record<string, { color: string; label: string }> = {
    critical: { color: 'bg-red-100 text-red-700 border-red-200', label: '긴급' },
    warning: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: '경고' },
    info: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: '정보' },
  }

  return (
    <div>
      <TopBar title="모니터링" subtitle="네이버 플레이스 순위 & 리뷰 모니터링" alertCount={2} />
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Rankings */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0F6E56]" />
              네이버 플레이스 키워드 순위
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MOCK_RANKINGS.map((item) => (
                <div key={item.keyword} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1 truncate">{item.keyword}</p>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold text-gray-900">#{item.rank}</p>
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${
                      item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {item.change > 0 ? <TrendingUp className="w-3 h-3" /> : item.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                      {item.change > 0 ? `+${item.change}` : item.change < 0 ? `${item.change}` : '변동없음'}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">지난주 #{item.lastWeek}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Reviews */}
          <div className="lg:col-span-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  최근 리뷰 모니터링
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {MOCK_REVIEWS.map((review) => (
                  <div key={review.id} className={`p-4 rounded-lg border ${review.sentiment === 'negative' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{review.author}</span>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{review.text}</p>

                    {review.sentiment === 'negative' && (
                      <div>
                        {replyDrafts[review.id] ? (
                          <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-xs font-medium text-gray-600 mb-1">AI 답변 초안:</p>
                            <p className="text-xs text-gray-700">{replyDrafts[review.id]}</p>
                            <Button size="sm" variant="outline" className="mt-2 text-xs h-7" onClick={() => { navigator.clipboard.writeText(replyDrafts[review.id]); toast.success('복사됨') }}>
                              복사
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => generateReply(review.id, review.text)}
                            disabled={loadingReply === review.id}
                          >
                            {loadingReply === review.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                            AI 답변 작성
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  활성 알림
                  <Badge className="bg-red-500 hover:bg-red-500 text-white text-xs h-5">
                    {MOCK_ALERTS.filter(a => a.severity !== 'info').length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {MOCK_ALERTS.map((alert) => {
                  const cfg = severityConfig[alert.severity]
                  return (
                    <div key={alert.id} className={`p-3 rounded-lg border text-xs ${cfg.color}`}>
                      <div className="flex items-start gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <p>{alert.message}</p>
                      </div>
                      <p className="text-right opacity-70">{alert.created_at}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
