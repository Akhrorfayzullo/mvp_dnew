'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2, Eye, Tag, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const SPECIALTIES = ['피부과', '치과', '안과', '성형외과', '정형외과', '한의원', '내과', '산부인과']

interface BlogResult {
  title: string
  content: string
  tags: string[]
  compliance_note: string
}

export default function BlogPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [specialty, setSpecialty] = useState('피부과')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BlogResult | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (data?.org_id) setOrgId(data.org_id)
    })
  }, [])

  async function handleGenerate() {
    if (!keyword.trim()) { toast.error('키워드를 입력해주세요'); return }
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, specialty, topic, org_id: orgId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '생성 실패')
      }

      const data: BlogResult = await res.json()
      setResult(data)
      toast.success('블로그 포스트가 생성되었습니다 (10 크레딧 사용)')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar title="블로그 포스트 생성" subtitle="네이버 SEO 최적화 의료 정보 블로그" />
      <div className="p-6 max-w-4xl">
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0F6E56]" />
              블로그 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>키워드 *</Label>
                <Input
                  placeholder="예: 여드름 레이저 치료"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
              </div>
              <div className="space-y-2">
                <Label>전문과</Label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>주제 (선택)</Label>
              <Input
                placeholder="예: 레이저 토닝과 IPL의 차이점"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">생성 비용: 10 크레딧</p>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !keyword.trim()}
                className="bg-[#0F6E56] hover:bg-[#0d5e48]"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />생성 중...</> : '블로그 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Naver Blog Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#0F6E56]" />
                  네이버 블로그 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-4">
                  <div className="bg-[#03C75A] px-4 py-2.5 flex items-center gap-2">
                    <span className="text-white font-bold text-sm">N</span>
                    <span className="text-white text-xs opacity-80">블로그</span>
                  </div>
                  <div className="p-6 bg-white">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{result.title}</h2>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {result.tags.map((tag) => (
                        <span key={tag} className="text-xs text-[#03C75A] bg-green-50 px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {result.content.substring(0, 500)}{result.content.length > 500 ? '...' : ''}
                    </div>
                    {result.content.length > 500 && (
                      <p className="text-xs text-gray-400 mt-3">전체 {result.content.length}자 · 아래 전체 본문에서 확인</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-[#0F6E56]" />
                  <span className="text-sm font-semibold">SEO 태그</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.tags.map((tag) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>

            {/* Full content */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">전체 본문</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(result.content); toast.success('복사됨') }}
                  >
                    <Copy className="w-3 h-3 mr-1" />복사
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                  {result.content}
                </div>
                {result.compliance_note && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800"><span className="font-semibold">의료법 준수 확인:</span> {result.compliance_note}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
