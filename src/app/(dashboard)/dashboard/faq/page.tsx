'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpCircle, Loader2, Copy, ChevronDown, ChevronUp, Code } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface FaqItem {
  question: string
  answer: string
}

interface FaqResult {
  faqs: FaqItem[]
  jsonld: string
}

export default function FaqPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [specialty, setSpecialty] = useState<string>('')
  const [treatment, setTreatment] = useState('')
  const [treatments, setTreatments] = useState<string[]>(['보톡스', '필러', '레이저 토닝', '리프팅', '여드름 치료'])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FaqResult | null>(null)
  const [expanded, setExpanded] = useState<number | null>(0)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!userData?.org_id) return
      setOrgId(userData.org_id)
      const { data: org } = await supabase.from('organizations').select('treatments, specialty').eq('id', userData.org_id).single()
      if (org?.treatments?.length) setTreatments(org.treatments)
      if (org?.specialty) setSpecialty(org.specialty)
    })
  }, [])

  async function handleGenerate() {
    if (!treatment) { toast.error('시술을 선택해주세요'); return }
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatment, specialty, org_id: orgId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '생성 실패')
      }

      const data: FaqResult = await res.json()
      setResult(data)
      setExpanded(0)
      toast.success('FAQ가 생성되었습니다 (5 크레딧 사용)')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar title="FAQ 생성" subtitle="시술별 자주 묻는 질문 + JSON-LD 스키마" />
      <div className="p-6 max-w-4xl">
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#0F6E56]" />
              시술 선택
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {treatments.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTreatment(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    treatment === t ? 'bg-[#0F6E56] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">선택된 시술: <strong>{treatment || '없음'}</strong> · 생성 비용: 5 크레딧</p>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !treatment}
                className="bg-[#0F6E56] hover:bg-[#0d5e48]"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />생성 중...</> : 'FAQ 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* FAQ Accordion */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{treatment} - 자주 묻는 질문</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.faqs.map((faq, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <span className="font-medium text-sm text-gray-900">{faq.question}</span>
                      {expanded === i
                        ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      }
                    </button>
                    {expanded === i && (
                      <div className="px-4 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* JSON-LD */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#0F6E56]" />
                    JSON-LD 스키마 마크업
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCode(!showCode)}>
                      {showCode ? '숨기기' : '보기'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard.writeText(result.jsonld); toast.success('JSON-LD 복사됨') }}
                    >
                      <Copy className="w-3 h-3 mr-1" />복사
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {showCode && (
                <CardContent>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto max-h-60">
                    {result.jsonld}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    병원 웹사이트 &lt;head&gt; 태그 안에 삽입하면 구글 검색 결과에 FAQ가 노출됩니다.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
