'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('로그인 실패: ' + error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Fetch user role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      const role = userData?.role || 'member'

      if (role === 'superadmin') {
        router.push('/admin')
      } else if (role === 'agent') {
        router.push('/agent')
      } else {
        router.push('/dashboard')
      }
    }
  }

  return (
    <div suppressHydrationWarning>
    <Card className="w-full max-w-md shadow-2xl border-0">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 bg-[#0F6E56] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">DNEW AI</span>
        </div>
        <CardTitle className="text-xl">로그인</CardTitle>
        <CardDescription>병원 AI 마케팅 플랫폼에 오신 것을 환영합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="hospital@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#0F6E56] hover:bg-[#0d5e48]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          계정이 없으신가요?{' '}
          <a href="/onboarding" className="text-[#0F6E56] hover:underline font-medium">
            병원 등록하기
          </a>
        </p>
      </CardContent>
    </Card>
    </div>
  )
}
