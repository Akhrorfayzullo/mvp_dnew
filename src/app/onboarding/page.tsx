'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Plus, X, Check, ChevronRight } from 'lucide-react'

const STEPS = [
  { title: '병원 기본 정보', description: '병원의 기본 정보를 입력해주세요' },
  { title: '시술 목록', description: '제공하는 시술을 추가해주세요' },
  { title: '디자인 설정', description: '브랜드 스타일을 선택해주세요' },
  { title: '웹사이트 연동', description: '병원 웹사이트를 연결해주세요 (선택)' },
  { title: '계정 생성', description: '로그인에 사용할 계정을 만들어주세요' },
]

const SPECIALTIES = ['피부과', '치과', '안과', '성형외과', '정형외과', '한의원', '내과', '산부인과', '비뇨기과', '이비인후과']
const DESIGN_STYLES = [
  { value: 'modern', label: '모던', desc: '깔끔하고 현대적인 느낌' },
  { value: 'luxury', label: '럭셔리', desc: '고급스럽고 프리미엄한 느낌' },
  { value: 'friendly', label: '친근함', desc: '따뜻하고 편안한 느낌' },
  { value: 'professional', label: '전문적', desc: '신뢰감 있는 의료 느낌' },
  { value: 'trendy', label: '트렌디', desc: '젊고 감각적인 느낌' },
]

const PRESET_COLORS = ['#0F6E56', '#2563EB', '#7C3AED', '#DC2626', '#D97706', '#059669', '#0891B2', '#BE185D']

export default function OnboardingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  // Step 2
  const [treatments, setTreatments] = useState<string[]>([])
  const [newTreatment, setNewTreatment] = useState('')
  // Step 3
  const [designStyle, setDesignStyle] = useState('')
  const [brandColor, setBrandColor] = useState('#0F6E56')
  // Step 4
  const [websiteUrl, setWebsiteUrl] = useState('')
  // Step 5
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Prevent hydration mismatch — only render after client mount
  useEffect(() => {
    setMounted(true)
  }, [])

  function addTreatment() {
    const trimmed = newTreatment.trim()
    if (!trimmed) return
    if (treatments.includes(trimmed)) return
    setTreatments((prev) => [...prev, trimmed])
    setNewTreatment('')
  }

  function removeTreatment(i: number) {
    setTreatments((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTreatment()
    }
  }

  async function handleSubmit() {
    if (!email.trim()) { toast.error('이메일을 입력해주세요'); return }
    if (password.length < 8) { toast.error('비밀번호는 8자 이상이어야 합니다'); return }
    setLoading(true)

    const supabase = createClient()

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role: 'owner' } },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('계정 생성에 실패했습니다')

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          specialty,
          phone: phone.trim() || null,
          address: address.trim() || null,
          treatments,
          design_style: designStyle || 'modern',
          brand_color: brandColor,
          website_url: websiteUrl.trim() || null,
          plan_type: 'lite',
          credit_balance: 500,
        })
        .select()
        .single()

      if (orgError) throw orgError

      await supabase
        .from('users')
        .update({ org_id: org.id })
        .eq('id', authData.user.id)

      toast.success('병원 등록이 완료되었습니다!')
      router.push('/login')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '등록 중 오류가 발생했습니다'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function canProceed(): boolean {
    if (step === 0) return !!(name.trim() && specialty)
    if (step === 1) return true // treatments optional — can skip
    if (step === 2) return true // design optional — defaults to 'modern'
    if (step === 3) return true // website optional
    return true
  }

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100)

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F6E56] via-[#0d5e48] to-[#0a4a38] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F6E56] via-[#0d5e48] to-[#0a4a38] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="text-2xl font-bold text-white">DNEW AI Platform</span>
          </div>
          <p className="text-white/70 text-sm">병원 AI 마케팅 플랫폼 시작하기</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-sm font-medium">단계 {step + 1} / {STEPS.length}</span>
            <span className="text-white/60 text-sm">{progressPct}%</span>
          </div>
          {/* Custom progress bar — avoid shadcn Progress hydration issues */}
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="flex justify-between mt-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Step content — keyed to force clean DOM swap */}
            <div key={`step-${step}`}>
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="hospital-name">병원명 *</Label>
                    <Input
                      id="hospital-name"
                      placeholder="예: 강남 ABC 피부과"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>전문과 *</Label>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALTIES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpecialty(s)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                            specialty === s
                              ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-[#0F6E56] hover:text-[#0F6E56]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="phone">전화번호</Label>
                      <Input
                        id="phone"
                        placeholder="02-1234-5678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">주소</Label>
                      <Input
                        id="address"
                        placeholder="서울시 강남구..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      id="new-treatment"
                      placeholder="시술명 입력 후 Enter (예: 보톡스, 필러)"
                      value={newTreatment}
                      onChange={(e) => setNewTreatment(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      onClick={addTreatment}
                      size="icon"
                      className="bg-[#0F6E56] hover:bg-[#0d5e48] flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {treatments.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm text-muted-foreground">아직 추가된 시술이 없습니다</p>
                      <p className="text-xs text-muted-foreground mt-1">건너뛰기를 눌러 나중에 추가할 수 있습니다</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-16">
                      {treatments.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-[#0F6E56]/10 text-[#0F6E56] border border-[#0F6E56]/20"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTreatment(i)}
                            className="hover:text-red-600 transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {treatments.length}개 추가됨 · 이 목록은 FAQ 생성, 메시지 작성에 활용됩니다
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {DESIGN_STYLES.map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setDesignStyle(style.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                          designStyle === style.value
                            ? 'border-[#0F6E56] bg-[#0F6E56]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${designStyle === style.value ? 'text-[#0F6E56]' : 'text-gray-900'}`}>
                            {style.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{style.desc}</p>
                        </div>
                        {designStyle === style.value && <Check className="w-4 h-4 text-[#0F6E56] flex-shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>브랜드 컬러</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBrandColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            brandColor === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: brandColor }} />
                      <span className="text-sm text-gray-600 font-mono">{brandColor}</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="website">병원 웹사이트 URL <span className="text-muted-foreground font-normal">(선택)</span></Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://www.hospital.co.kr"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      웹사이트 URL은 선택사항입니다. 입력하지 않아도 다음 단계로 진행할 수 있으며, 나중에 설정에서 추가할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">소셜 채널 연동 <span className="text-xs text-muted-foreground font-normal">(준비 중)</span></p>
                    <div className="space-y-2">
                      {['네이버 스마트플레이스', '카카오 채널', '인스타그램'].map((ch) => (
                        <div key={ch} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <span className="text-sm text-gray-600">{ch}</span>
                          <Badge variant="outline" className="text-xs text-gray-400">준비 중</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <p className="text-sm font-semibold text-gray-900">계정 생성</p>
                    <div className="space-y-2">
                      <Label htmlFor="email">이메일 *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="hospital@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">비밀번호 *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="8자 이상"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-4">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={loading}
                >
                  이전
                </Button>
              ) : (
                <a
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-gray-700 transition-colors"
                >
                  이미 계정이 있나요?
                </a>
              )}

              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed()}
                  className="bg-[#0F6E56] hover:bg-[#0d5e48] gap-1"
                >
                  {step === 1 && treatments.length === 0 ? '건너뛰기' : '다음'}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !email.trim() || password.length < 8}
                  className="bg-[#0F6E56] hover:bg-[#0d5e48]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    '등록 완료'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
