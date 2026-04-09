'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Loader2, Star, TrendingUp, TrendingDown, Lightbulb, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Competitor {
  name: string
  rank: number
  rating: number
  reviews: number
  strength: string
  weakness: string
}

interface CompetitorResult {
  keyword: string
  competitors: Competitor[]
  insights: string
  opportunity: string
}

export default function CompetitorPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompetitorResult | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (data?.org_id) setOrgId(data.org_id)
    })
  }, [])

  async function handleAnalyze() {
    if (!keyword.trim()) { toast.error('키워드를 입력해주세요'); return }
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, org_id: orgId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '분석 실패')
      }

      const data: CompetitorResult = await res.json()
      setResult(data)
      toast.success('경쟁사 분석이 완료되었습니다 (15 크레딧 사용)')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar title="경쟁사 분석" subtitle="AI 기반 네이버 플레이스 경쟁 분석" />
      <div className="p-6 max-w-5xl">
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="검색 키워드 입력 (예: 강남 피부과, 홍대 치과)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="pl-10"
                />
              </div>
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-[#0F6E56] hover:bg-[#0d5e48] px-6"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />분석 중...</>
                  : <><Users className="mr-2 h-4 w-4" />분석 시작</>
                }
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">분석 비용: 15 크레딧</p>
          </CardContent>
        </Card>

        {loading && (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-[#0F6E56] mx-auto mb-4" />
            <p className="text-gray-600 font-medium">AI가 경쟁사를 분석하고 있습니다...</p>
            <p className="text-sm text-muted-foreground mt-1">약 10-15초 소요됩니다</p>
          </div>
        )}

        {result && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Comparison Table */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  &quot;{result.keyword}&quot; 경쟁사 비교 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">순위</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">병원명</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">평점</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">리뷰</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">강점</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">약점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.competitors.map((c, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <span className={`font-bold text-lg ${
                              i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-gray-500'
                            }`}>
                              #{c.rank}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium">{c.name}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                              <span>{c.rating}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">{c.reviews.toLocaleString()}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 text-green-700">
                              <TrendingUp className="w-3 h-3 flex-shrink-0" />
                              <span className="text-xs">{c.strength}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 text-red-600">
                              <TrendingDown className="w-3 h-3 flex-shrink-0" />
                              <span className="text-xs">{c.weakness}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Competitor Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.competitors.map((c, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                      <Badge variant="outline" className="text-xs">#{c.rank}위</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />강점
                        </p>
                        <p className="text-xs text-green-800">{c.strength}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />약점
                        </p>
                        <p className="text-xs text-red-800">{c.weakness}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Insights + Opportunity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-l-4 border-l-[#0F6E56] border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-[#0F6E56] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-2">AI 시장 인사이트</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.insights}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500 border-0 shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm mb-2">우리 병원의 기회</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.opportunity}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
