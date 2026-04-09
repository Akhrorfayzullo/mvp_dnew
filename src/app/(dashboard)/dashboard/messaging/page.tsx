'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Loader2, Send, Copy, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const MESSAGE_TYPES = [
  { value: 'vip_recall', label: 'VIP 리콜', desc: 'VIP 고객 재방문 유도' },
  { value: 'win_back', label: '이탈환자 윈백', desc: '장기 미방문 고객' },
  { value: 'post_procedure', label: '시술 후 주의사항', desc: '시술 후 관리 안내' },
  { value: 'event', label: '이벤트 안내', desc: '특별 이벤트 알림' },
  { value: 'reminder', label: '예약 리마인더', desc: '예약 확인 메시지' },
]

interface MessagingResult {
  kakao: string
  sms: string
  compliance: string
}

export default function MessagingPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [hospitalName, setHospitalName] = useState('')
  const [messageType, setMessageType] = useState('vip_recall')
  const [treatment, setTreatment] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MessagingResult | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!data?.org_id) return
      setOrgId(data.org_id)
      const { data: org } = await supabase.from('organizations').select('name').eq('id', data.org_id).single()
      if (org?.name) setHospitalName(org.name)
    })
  }, [])

  async function handleGenerate() {
    if (!treatment.trim()) { toast.error('시술/서비스명을 입력해주세요'); return }
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: messageType, treatment, hospital_name: hospitalName, org_id: orgId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '생성 실패')
      }

      const data: MessagingResult = await res.json()
      setResult(data)
      toast.success('메시지가 생성되었습니다 (5 크레딧 사용)')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '생성 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    setSending(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSending(false)
    toast.success('발송 준비 완료 (카카오 비즈메시지 연동 준비 중)')
  }

  return (
    <div>
      <TopBar title="환자 메시지" subtitle="카카오톡 & SMS 자동 생성" />
      <div className="p-6 max-w-4xl">
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#0F6E56]" />
              메시지 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">메시지 유형</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {MESSAGE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setMessageType(type.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      messageType === type.value
                        ? 'border-[#0F6E56] bg-[#0F6E56]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${messageType === type.value ? 'text-[#0F6E56]' : 'text-gray-900'}`}>
                      {type.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>시술/서비스명</Label>
              <Input
                placeholder="예: 보톡스, 리프팅, 스케일링"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">생성 비용: 5 크레딧</p>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !treatment.trim()}
                className="bg-[#0F6E56] hover:bg-[#0d5e48]"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />생성 중...</> : '메시지 생성'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {/* KakaoTalk Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#FEE500]" />
                  카카오톡 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#B2C7D9] rounded-xl p-4 min-h-48">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 bg-[#FEE500] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold">병원</span>
                    </div>
                    <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 max-w-xs shadow-sm">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{result.kakao}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { navigator.clipboard.writeText(result.kakao); toast.success('복사됨') }}
                  >
                    <Copy className="w-3 h-3 mr-1" />복사
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-[#FEE500] text-gray-900 hover:bg-[#f0d800]"
                    onClick={handleSend}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                    발송하기
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* SMS Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-gray-500" />
                  SMS 버전
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 rounded-xl p-4 min-h-48">
                  <div className="bg-white rounded-xl p-3 shadow-sm border">
                    <p className="text-xs text-gray-500 mb-2">[{hospitalName || '병원명'}]</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{result.sms}</p>
                    <p className="text-xs text-gray-400 mt-2">{result.sms.length}자 / 90자</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => { navigator.clipboard.writeText(result.sms); toast.success('SMS 복사됨') }}
                >
                  <Copy className="w-3 h-3 mr-1" />SMS 복사
                </Button>
              </CardContent>
            </Card>

            {/* Compliance */}
            {result.compliance && (
              <div className="md:col-span-2">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <span className="font-semibold">의료법 준수 확인:</span> {result.compliance}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
