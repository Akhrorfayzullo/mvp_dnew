'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const EXAMPLES = [
  '국내 최고의 피부과 전문의가 직접 시술합니다. 100% 만족 보장!',
  '레이저 토닝 시술 후 즉각적인 피부 개선 효과를 경험하실 수 있습니다.',
  '저희 병원은 식약처 허가를 받은 의료기기만 사용하며 안전한 시술을 제공합니다.',
]

const severityConfig: Record<string, { color: string; label: string }> = {
  HIGH: { color: 'bg-red-100 text-red-700 border-red-300', label: '심각' },
  MID: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: '중간' },
  LOW: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: '낮음' },
}

interface Violation {
  severity: 'HIGH' | 'MID' | 'LOW'
  issue: string
  fix: string
}

interface ComplianceResult {
  score: number
  verdict: 'PASS' | 'FAIL'
  violations: Violation[]
  summary: string
  newCreditBalance?: number
}

export default function CompliancePage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplianceResult | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (data?.org_id) setOrgId(data.org_id)
    })
  }, [])

  async function handleCheck() {
    if (!text.trim()) { toast.error('광고 텍스트를 입력해주세요'); return }
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, org_id: orgId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '분석 실패')
      }

      const data: ComplianceResult = await res.json()
      setResult(data)
      toast.success('분석이 완료되었습니다 (3 크레딧 사용)')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar title="광고 적합성 검사" subtitle="의료법 제56조 기반 AI 광고 분석" />
      <div className="p-6 max-w-4xl">
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0F6E56]" />
              광고 텍스트 입력
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">예시 텍스트로 빠르게 테스트해보세요:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setText(ex)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                  >
                    예시 {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="검사할 광고 텍스트를 입력하세요..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{text.length}자 · 검사 비용: 3 크레딧</p>
              <Button
                type="button"
                onClick={handleCheck}
                disabled={loading || !text.trim()}
                className="bg-[#0F6E56] hover:bg-[#0d5e48]"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />분석 중...</>
                  : '적합성 검사'
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Score card */}
            <Card className={`border-2 ${result.verdict === 'PASS' ? 'border-green-300' : 'border-red-300'}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {result.verdict === 'PASS'
                      ? <CheckCircle className="w-8 h-8 text-green-600" />
                      : <XCircle className="w-8 h-8 text-red-600" />
                    }
                    <div>
                      <p className="font-bold text-xl">{result.verdict === 'PASS' ? '적합' : '부적합'}</p>
                      <p className="text-sm text-muted-foreground">광고 적합성 판정</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-gray-900">{result.score}</p>
                    <p className="text-sm text-muted-foreground">/ 100점</p>
                  </div>
                </div>
                <Progress value={result.score} className="h-3" />
                {result.summary && (
                  <p className="text-sm text-gray-600 mt-4">{result.summary}</p>
                )}
              </CardContent>
            </Card>

            {/* Violations */}
            {result.violations.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    위반 사항 ({result.violations.length}건)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.violations.map((v, i) => {
                    const cfg = severityConfig[v.severity] ?? severityConfig.LOW
                    return (
                      <div key={i} className={`p-4 rounded-lg border ${cfg.color}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-sm">{v.issue}</p>
                          <Badge className={`text-xs flex-shrink-0 ${cfg.color}`} variant="outline">
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs">
                          <span className="font-semibold">수정 제안: </span>{v.fix}
                        </p>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {/* No violations */}
            {result.violations.length === 0 && (
              <Card className="border-0 shadow-sm border-green-200 bg-green-50">
                <CardContent className="p-5 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-800">위반 사항이 없습니다. 광고 문구가 의료법 기준에 적합합니다.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
